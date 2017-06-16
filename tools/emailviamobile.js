#!/usr/bin/node
'use strict';
const fs = require("fs");
const delivery = require("delivery");
const config = require("../config");
const conf = config.tools['sendemail'][config.tools['sendemail']['checked']];
const spawn = require('child_process').spawn;

var rows = [];
process.stdin.on('data', function(d){
	rows.push(d.toString());
//- 	process.stdin.end(); // !!! убрать
});

const email = process.argv[2];

process.stdin.on('close', function(d){
	const body = rows.join('');
	if(email){
		startWvdial(
			function(cb){ //вызывается через 20 сек
				console.log('starting send email... ');
				delivery.mail.send({to: email, subj: config.myname + ': Оповещение об отказе', text: body || ''}, conf, 2,
					function(result){
						console.log('ok');
						cb();
					},
					cb
				);
			},
			function(){
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

function startWvdial(onready, callback, callback_err){
	try{
		const proc = spawn( (config.sys && config.sys['wvdial'])?config.sys['wvdial']:'/usr/bin/wvdial', [] );
		const rows = [];
		const err_mess = [];
		proc.stdout.on('data', (r) => { rows.push(r.toString()); });
		proc.stderr.on('data', (r) => { err_mess.push(r.toString()); });
		proc.on('close', function(code){});
		setTimeout(function(){
			onready(function(err){
				proc.kill('SIGTERM');
				setTimeout(function(){
					if(err){
						callback_err(err);
					}else{
						callback();
					};
				}, 2000);
			});
		}, 20000);
	}catch(err){
		callback_err(['Tool not found?  :: ' + err.message]);
	};
};
