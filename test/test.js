var dolphin = require('./')('http://localhost:9999');

dolphin.events({
	since: Date.now() / 1000,
	until: Date.now() / 1000
})
.on('event', function(evt){
	console.log(evt);
})

dolphin.version().then(function(info){
	console.log(info);
})

dolphin.info().then(function(info){
	console.log(info);
})
