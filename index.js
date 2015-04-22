'use strict';

var url = require('url');
var http = require('http');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var querystring = require('querystring');

var RESTART_WAIT = 5000;

var Dolphin = function(_url, opts) {
  if (!(this instanceof Dolphin)){
  	return new Dolphin(_url, opts);
  }

  _url = _url || process.env.DOCKER_HOST || '/var/run/docker.sock';
  this.url = _url = _url.replace('tcp://', 'http://').replace(/\/+$/, "");

  //
  // Assume a UNIX domain socket if no protocol provided
  //
  if(!url.parse(_url).protocol){
  	this.isSocket = true;
  }

  this.opts = opts;

  var _this = this;

  this.containers.inspect = function(id){
  	return _this._get('containers/' + id + '/json');
  }

  this.containers.logs = function(id){
  	// TODO: disable json parse
  	return _this._get('containers/' + id + '/logs');
  }

  this.containers.changes = function(id){
  	return _this._get('containers/' + id + '/changes');
  }

  this.containers.export = function(id){
  	// TODO: disable json parse
  	return _this._get('containers/' + id + '/export');
  }

  this.containers.stats = function(id){
  	// TODO: "getStream"
  	return _this._get('containers/' + id + '/stats');
  }
};

Dolphin.prototype.containers = function(query){
	return this._get('containers/json', query);
}

Dolphin.prototype.info = function() {
	return this._get('info');
}

Dolphin.prototype.version = function() {
	return this._get('version');
}

Dolphin.prototype.events = function(query) {
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

Dolphin.prototype._get = function(path, query){

	var opts = {
		url: buildUrl(this.url, path, query, this.isSocket)
	};

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
