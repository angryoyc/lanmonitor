#!/usr/bin/node
const conf = require("./config");
const cf = require("cf");
const fs = require("fs");
const async = require("async");
const spawn = require('child_process').spawn;
const ESC = '\x1b[';
const macros={};
const fails=[];

function loadLastFails(callback, callback_err){
	var path = (conf.path?conf.path.failslog:'')  || './failslog.json';
	console.log('Reading lastfails log file: ' + path);
	try{
		var lastfailslog = require(path);
		if(cf.isArray(lastfailslog)){
			callback(lastfailslog, path);
		}else{
			callback([], path);
		};
	}catch(e){
		callback([], path);
	};
};

loadLastFails(function(lastfailslog, path){
	console.log('Last failslog items count: ' + lastfailslog.length);
	var index={};
	if(lastfailslog.length>0){
		lastfailslog.forEach(function(f){
			index[f.nodeid]=f;
		});
	};
	doNodes(conf, 
		function(){
			if(fails.length>0){
				var newfails = fails.filter(function(f){
					return !(f.nodeid in index);
				});
				if(newfails.length>0){
					process.stdout.write('New fails counter: ' + newfails.length + '\n');
					process.stdout.write('Need to inform opers\n');
				}
				saveFailsLog(fails, path, function(){
					process.stdout.write('stop\n');
				}, function(){});
			};
		},
		function(err){
			process.stderr.write(err.message);
		}
	);
});

function saveFailsLog(fails, path, callback, callback_err){
	fs.writeFile(path, JSON.stringify(fails), "UTF-8", function(err){
		if(err){
			callback_err(err);
		}else{
			callback();
		};
	});
}

function doNodes(parent, callback, callback_err){
	if( cf.isArray(parent.nodes) ){
		async.forEachLimit(
			parent.nodes, 1,
			function(node, cb){
				doNode(node, function(result){
					if(result.status.toLowerCase()=='ok'){
						doNodes(node, cb, callback_err)
					}else{
						cb();
					};
				}, cb);
			},
			function(err){
				if(err){
					callback_err(err);
				}else{
					callback();
				}
			}
		);
	}else{
		callback();
	};
}

function doNode(node, callback, callback_err){
	const result = { status:'ok' };
	if(!node.type){
		callback(result);
	}else if(node.type=='ping'){
		process.stdout.write('Pinging to host ' + node.ip + ' ... ');
		ping(node.ip, function(ret){
			result.status = ret;
			if( result.status == 'ok' ){
				process.stdout.write(ESC + '32m');
				macros['{ip}'] = node.ip;
			}else{
				process.stdout.write(ESC + '31m');
				fails.push({nodeid:cf.md5(node.type + node.ip), status:result.status, type: node.type, ip:node.ip, dt: new Date()});
			};
			process.stdout.write(result.status);
			process.stdout.write(ESC + '0m');
			if(node.note) process.stdout.write('\t\t# ' + node.note + '\n');
			callback(result);
		}, callback_err);
	}else if(node.type=='ping'){
	}else{
		callback(result);
	};
};

function ping(ip, callback, callback_err){
	const params = [ip, '-c', 7];
	const ping = spawn((conf.sys?conf.sys.ping:'') || 'ping' , params);
	const rows = [];
	const err_mess = [];
	ping.stdout.on('data', (r) => {
		rows.push(r.toString());
	});
	ping.stderr.on('data', (err) => {err_mess.push(err.message.toString())});
	ping.on('close', function(code){
		const lines = rows.join('').split(/\n/).filter(function(r){return r;});
		const resstring = lines.filter(function(l){
			return l.match(/packets transmitted.+\d+\% packet loss/);
		})[0];
		const m=resstring.match(/(\d+)\% packet loss/);
		if(m[1]>50){
			callback('fail');
		}else{
			callback('ok');
		};
	});
};
