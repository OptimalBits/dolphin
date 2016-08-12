//var dolphin = require('../')('http://localhost:9999/');
var dolphin = require('../')();

dolphin.events({
	since: Date.now() / 1000,
	until: Date.now() / 1000
}).on('event', function(evt){
	console.log(evt);
}).on('error', function(err){
	console.log('Error:', err);
});


/*
dolphin.version().then(function(info){
	console.log(info);
})

dolphin.info().then(function(info){
	console.log(info);
})
*/
/*
dolphin.containers
	.inspect('b6905639cab3aecc33e59ccb6c4c69cfcde6b813eb00efadb5191c3c5b7257e4')
	.then(function(container){
		console.log(container);
}, function(err){
	console.log(err);
});
*/

/*
dolphin.version().then(function(info){
	console.log(info);
})
*/

dolphin.containers({filters: '{"status":["running"]}'}).then(function(info){
	console.log(info);
	console.log(info[1].Ports);
})
