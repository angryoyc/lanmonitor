#!/usr/bin/node

const webreq=require("./webreq");
var fails = [];
webreq.test(
	{
		"url": "https://lenta.ru",
		"note": "Сервер в интернет"
	},
	function(){
		//console.log(fails)
	},
	function(err){
		console.log(err);
	},
	fails
);
