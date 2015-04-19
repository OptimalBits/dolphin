'use strict';

var url = require('url');
var http = require('http');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

var RESTART_WAIT = 5000;

var Dolphin = function(_url, opts) {
  if (!(this instanceof Dolphin)) return new Dolphin(_url, opts);

  url = url || process.env.DOCKER_HOST || 'http://unix:/var/run/docker.sock';

  this.url = url.parse(_url);
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

Dolphin.prototype.events = function(opts) {
	opts = opts || {};

	var url = this.url.href + '/events';
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
			qs: opts
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
		})
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
	var href = this.url.href + '/' + path;

	var opts = {
		url: href
	};

	if(query){
		opts.qs = query;
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

module.exports = Dolphin;
