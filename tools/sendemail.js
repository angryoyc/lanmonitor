#!/usr/bin/node
'use strict';
const fs = require("fs");
const delivery = require("delivery");
const config = require("../config");
const conf = config.tools['sendemail'][config.tools['sendemail']['checked']];


var rows = [];
process.stdin.on('data', function(d){
	rows.push(d.toString());
//	process.stdin.end();
});

const email = process.argv[2];

process.stdin.on('close', function(d){
	const body = rows.join('');
	if(email){
		delivery.mail.send({to: email, subj: config.myname + ': Оповещение об отказе', text: body || ''}, conf, 2,
			function(result){
				console.log('ok');
				process.exit(0);
			},
			function(err){
				console.log(err);
				process.exit(1);
			}
		);
	}else{
		process.exit(1);
	};
});
