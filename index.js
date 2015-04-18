'use strict';

var url = require('url');
var http = require('http');
var request = require('request');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');


var Dolphin = function(_url, opts) {
  if (!(this instanceof Dolphin)) return new Dolphin(_url, opts);

  url = url || process.env.DOCKER_HOST || 'http://unix:/var/run/docker.sock';

  this.url = url.parse(_url);
  this.opts = opts;
};

Dolphin.prototype.info = function() {
	return this._get('info');
}

Dolphin.prototype.version = function() {
	return this._get('version');
}

Dolphin.prototype.events = function(opts) {
	var emitter = new EventEmitter;

	var req = request({
		url: this.url.href + '/events',
		qs: opts
	}).on('data', function(chunk){
		var evt;
		try{
			evt = JSON.parse(chunk.toString());
			emitter.emit('event', evt);
		}catch(err){
			emitter.emit('error', err);
		}
	}).on('error', function(err){
		emitter.emit('error', err);
	});

	emitter.req = req;
	return emitter;
}

Dolphin.prototype._get = function(path){
	var href = this.url.href + '/' + path;
	console.log(href)
	return new Promise(function(resolve, reject){
		request(href, function(err, response, body){
			console.log(body)
			if(err) return reject(err);

			 try{
			 	resolve(JSON.parse(body));
			 }catch(err){
			 	reject(err);
			 }
		});
	});
}

module.exports = Dolphin;
