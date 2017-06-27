#!/usr/bin/node

const dfutil=require("./df");
var fails = [];
dfutil.test(
	{
		"ssh": "serg@bk.holding.priv",
		"blk": "/dev/vdb",
		"threshold": 20
	},
	function(){
		console.log(fails)
	},
	function(err){
		console.log(err);
	},
	fails
);
