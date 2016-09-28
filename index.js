'use strict';

var url = require('url');
var http = require('http');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var images = require('./lib/images');
var nodes = require('./lib/nodes')
var networks = require('./lib/networks');
var volumes = require('./lib/volumes');
var services = require('./lib/services');

var RESTART_WAIT = 5000;

var Dolphin = function (opts) {
  if (!(this instanceof Dolphin)) {
    return new Dolphin(opts);
  }

  var env = this.env = process.env;
  if (typeof opts === 'string') {
    env = getMachineEnv(opts);
    this.env = _.extend(this.env, env);
    opts = {};
  }

  opts = opts || {};

  var _url = opts.url || env.DOCKER_HOST || '/var/run/docker.sock';
  _url = url.parse(_url);
  if (_url.protocol) {
    var protocol = 'http';
    if (env.DOCKER_TLS_VERIFY === '1' || _url.port === '2376') {
      protocol = 'https';

      if (env.DOCKER_CERT_PATH) {
        opts.ca = fs.readFileSync(path.join(env.DOCKER_CERT_PATH, 'ca.pem'));
        opts.cert = fs.readFileSync(path.join(env.DOCKER_CERT_PATH, 'cert.pem'));
        opts.key = fs.readFileSync(path.join(env.DOCKER_CERT_PATH, 'key.pem'));
      }
    }
    this.url = protocol + '://' + _url.host;
  } else {
    //
    // Assume a UNIX domain socket if no protocol provided
    //
    this.url = _url.href;
    this.isSocket = true;
  }

  this.opts = opts;

  var _this = this;

  this.containers.inspect = function (id) {
    return _this._get('containers/' + id + '/json', null, _this.opts);
  }

  this.containers.logs = function (id) {
    // TODO: disable json parse
    return _this._get('containers/' + id + '/logs', null, _this.opts);
  }

  this.containers.changes = function (id) {
    return _this._get('containers/' + id + '/changes', null, _this.opts);
  }

  this.containers.export = function (id) {
    // TODO: disable json parse
    return _this._get('containers/' + id + '/export', null, _this.opts);
  }

  this.containers.stats = function (id) {
    // TODO: "getStream"
    return _this._get('containers/' + id + '/stats', null, _this.opts);
  }

  //
  // Attach methods
  //
  this.images = images(this);
  this.nodes = nodes(this);
  this.volumes = volumes(this);
  this.networks = networks(this);
  this.services = services(this);
};

Dolphin.prototype.containers = function (query) {
  return this._get('containers/json', query, this.opts);
}

Dolphin.prototype.info = function () {
  return this._get('info', null, this.opts);
}

Dolphin.prototype.version = function () {
  return this._get('version', null, this.opts);
}

Dolphin.prototype.events = function (query) {
  var _this = this;
  var url = buildUrl(this.url, 'events', query, this.isSocket);
  var emitter = new EventEmitter;
  var latestTime;
  var req;
  var restartTimeout;

  emitter.abort = function () {
    req && req.abort();
    clearTimeout(restartTimeout);
  }

  function startStreaming() {
    return request({
      url: url,
      ca: _this.opts.ca,
      cert: _this.opts.cert,
      key: _this.opts.key,
      headers: _this.isSocket ? { host: 'http' } : void 0
    }).on('data', function (chunk) {
      var evt;
      try {
        evt = JSON.parse(chunk.toString());
        latestTime = evt.time;
        emitter.emit('event', evt);
      } catch (err) {
        emitter.emit('error', err);
      }
    }).on('error', function (err) {
      emitter.emit('error', err);
      restart();
    }).on('end', function () {
      restart();
    }).on('close', function (doc) {
      restart();
    }).on('response', function (res) {
      if (res.statusCode === 200) {
        emitter.emit('connected');
      } else {
        emitter.emit('error', Error("Error connecting with status " + res.statusCode));
      }
    });
  }

  function restart() {
    setTimeout(function () {
      if (latestTime) {
        opts.since = latestTime;
      }
      req = startStreaming();
    }, RESTART_WAIT);
  }

  req = startStreaming(emitter);

  return emitter;
}

Dolphin.prototype.docker = function(args){
  var _this = this;
  var child = require('child_process');
  return new Promise(function(resolve, reject){
    var docker = child.spawn('docker', args, {env: _this.env});
    var result = '';
    var err = '';

    docker.stdout.on('data', function(data){
      result += data;
    });

    docker.stderr.on('data', function(data){
      err += data;
    });

    docker.on('close', function(code){
      return code === 0 ? resolve(result.toString()) : reject(err);
    });
  });
}

Dolphin.prototype._list = function(bucket, idOrFilters, opts){
  var query;
  if(idOrFilters){
    if(_.isString(idOrFilters)){
      return this._get(bucket + '/' + idOrFilters, null, opts);
    }
    query = {
      filters: idOrFilters
    }
  }
  return this._get(bucket, query, opts);
}

Dolphin.prototype._get = function (path, query, args) {
  return this._request('GET', path, query, args);
}

Dolphin.prototype._post = function (path, body, args) {
  args = args ? _.clone(args) : {};
  args.body = body;
  return this._request('POST', path, null, args);
}

Dolphin.prototype._delete = function (path, args) {
  return this._request('DELETE', path, null, args);
}

Dolphin.prototype._request = function(method, path, query, args){
  var opts = args ? _.clone(args) : {};
  opts.url = buildUrl(this.url, path, query, this.isSocket);
  opts.method = method;
  opts.json = true;

  if (this.isSocket) {
    // Workaround for request bug https://github.com/request/request/issues/2327
    opts.headers = { host: 'http' };
  }

  return new Promise(function (resolve, reject) {
    request(opts, function (err, response, body) {
      if (err) return reject(err);

      if([200, 201, 204].indexOf(response.statusCode) != -1){
        try {
          resolve(body);
          //resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      }else if(response.statusCode === 404 && opts.method !== 'POST'){
        resolve();
      }else{
        return reject(Error('Request failed: ' + response.statusCode + ':' + JSON.stringify(body)));
      }
    });
  });
}

function buildUrl(url, path, query, isSocket) {
  if (isSocket) {
    url = 'http://unix:' + url + ':/' + path;
  } else {
    url = url + '/' + path;
  }
  if (query) {
    if(query.filters){
      query.filters = filtersToJSON(query.filters);
    }
    url += '?' + querystring.stringify(query);
  }
  return url;
}

function filtersToJSON(filters){
  var keys = Object.keys(filters);
  keys.forEach(function(key){
    filters[key] = [filters[key].toString()];
  })
  return JSON.stringify(filters);
}

/**
 * Returns the env vars for the given docker machine.
 */
function getMachineEnv(machine) {
    var child = require('child_process');
    var result = child.spawnSync('docker-machine', ['env', machine]);

    if(result.status === 0){
      var str = result.stdout.toString();
      var expr = str
        .replace(new RegExp('export ', 'g'), 'envs.')
        .split('\n')
        .filter(function (line) {
          return line[0] !== '#';
      }).join(';')

      var envs = {};
      eval(expr);
      return envs;
    }else{
      throw Error(result.stderr)
    }
}

module.exports = Dolphin;
