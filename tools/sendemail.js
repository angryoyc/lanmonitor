#!/usr/bin/node
'use strict';
const fs = require("fs");

var rows=[];
process.stdin.on('data', function(d){
	rows.push(d.toString());
});

process.stdin.on('close', function(d){
	fs.writeFile('./log.log', rows.join(''), 'UTF-8', function(err){
		process.exit(0);
	});
});
