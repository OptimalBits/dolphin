# Dolphin
A fast and lightweight module to interact with docker daemons.

This module provides a thin layer to communicate with docker daemons in node.
The api is promise and events based trying to follow the semantics of
docker's remote api as closely as possible.


# Install

```npm install dolphin```


# Usage

The module needs to be instantiated with an optional url pointing to the docker daemon.
Otherwise it will use the standard docker's Unix domain socket (```unix:///var/run/docker.sock```)


```
var Dolphin = require('dolphin');

var dolphin = Dolphin({
	url: 'http://mydockerhost.com: 1234'
})


dolphin.containers().then(function(containers){
	// Containers contains an array of docker containers.
	// https://docs.docker.com/reference/api/docker_remote_api_v1.18/#list-containers
})


// Query parameters are also supported
dolphin.containers({
	all: {Boolean},	// Show all containers even stopped ones.
	limit: {Integer},
	since: {Integer}, // Show containers created since given timestamp
	before: {Integer}, // Show containers created before given timestamp
	size: {Boolean},
	filters: {String}, // exited=<int> status=(restarting|running|paused|exited)
}).then(function(containers){

})

```
