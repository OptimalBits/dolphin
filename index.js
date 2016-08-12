'use strict';

var url = require('url');
var http = require('http');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var querystring = require('querystring');
var fs = require('fs');
var path = require('path');

var RESTART_WAIT = 5000;

var Dolphin = function(_url, opts) {
  if (!(this instanceof Dolphin)){
    return new Dolphin(_url, opts);
  }

  opts = opts || {};

  _url = _url || process.env.DOCKER_HOST || '/var/run/docker.sock';
  _url = url.parse(_url);
  if(_url.protocol){
    var protocol = 'http';
    if (process.env.DOCKER_TLS_VERIFY === '1' || _url.port === '2376') {
      protocol = 'https';

      if (process.env.DOCKER_CERT_PATH) {
        opts.ca = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'ca.pem'));
        opts.cert = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'cert.pem'));
        opts.key = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'key.pem'));
      }
    }
    this.url = protocol + '://' + _url.host;
  }else{
    //
    // Assume a UNIX domain socket if no protocol provided
    //
		this.url = _url.href;
    this.isSocket = true;
  }

  this.opts = opts;

  var _this = this;

  this.containers.inspect = function(id){
  	return _this._get('containers/' + id + '/json', null, _this.opts);
  }

  this.containers.logs = function(id){
  	// TODO: disable json parse
  	return _this._get('containers/' + id + '/logs', null, _this.opts);
  }

  this.containers.changes = function(id){
  	return _this._get('containers/' + id + '/changes', null, _this.opts);
  }

  this.containers.export = function(id){
  	// TODO: disable json parse
  	return _this._get('containers/' + id + '/export', null, _this.opts);
  }

  this.containers.stats = function(id){
  	// TODO: "getStream"
  	return _this._get('containers/' + id + '/stats', null, _this.opts);
  }
};

Dolphin.prototype.containers = function(query){
	return this._get('containers/json', query, this.opts);
}

Dolphin.prototype.info = function() {
	return this._get('info', null, this.opts);
}

Dolphin.prototype.version = function() {
	return this._get('version', null, this.opts);
}

Dolphin.prototype.events = function(query) {
	var _this = this;
	var url = buildUrl(this.url, 'events', query, this.isSocket);
	var emitter = new EventEmitter;
	var latestTime;
	var req;
	var restartTimeout;

	emitter.abort = function(){
		req && req.abort();
		clearTimeout(restartTimeout);
	}

	function startStreaming(){
		return request({
			url: url,
      ca: _this.opts.ca,
      cert: _this.opts.cert,
      key: _this.opts.key,
			headers: _this.isSocket ? {host: 'http'} : void 0
		}).on('data', function(chunk){
			var evt;
			try{
				evt = JSON.parse(chunk.toString());
				latestTime = evt.time;
				emitter.emit('event', evt);
			}catch(err){
				emitter.emit('error', err);
			}
		}).on('error', function(err){
			emitter.emit('error', err);
			restart();
		}).on('end', function(){
			restart();
		}).on('close', function(doc){
			restart();
		}).on('response', function(res){
			if(res.statusCode === 200){
				emitter.emit('connected');
			}else{
				emitter.emit('error', Error("Error connecting with status "+res.statusCode));
			}
		});
	}

	function restart(){
		setTimeout(function(){
			if(latestTime){
				opts.since = latestTime;
			}
			req = startStreaming();
		}, RESTART_WAIT);
	}

	req = startStreaming(emitter);

	return emitter;
}

Dolphin.prototype._get = function(path, query, args){

	var opts = args || {};
	opts.url = buildUrl(this.url, path, query, this.isSocket);

	if(this.isSocket){
		// Workaround for request bug https://github.com/request/request/issues/2327
		opts.headers = {host: 'http'};
	}

	return new Promise(function(resolve, reject){
		request(opts, function(err, response, body){
			if(err) return reject(err);

			if(response.statusCode != 200){
				return reject(Error('Request failed: '+response.statusCode));
			}

			try{
				resolve(JSON.parse(body));
			}catch(err){
			 	reject(err);
			}
		});
	});
}

function buildUrl(url, path, query, isSocket){
	if(isSocket){
		url = 'http://unix:' + url + ':/' + path;
	}else{
		url = url + '/'+ path;
	}
	if(query){
		url += '?' + querystring.stringify(query);
	}
	return url;
}

module.exports = Dolphin;
