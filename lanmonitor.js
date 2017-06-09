#!/usr/bin/node

const conf = require("./config");
const cf = require("cf");
const fs = require("fs");
const async = require("async");
const spawn = require('child_process').spawn;
const ESC = '\x1b[';
const macros = {};
const fails = [];
//const points = [{cmd:'{emailviamobile} {email}', order:99}];
const points = conf.predefined || [];

// START !!!
loadLastFails(function(lastfailslog, path){ // загружаем журнал предыдущей проверки
	console.log('Last failslog items count: ' + lastfailslog.length);
	var index={};
	if(lastfailslog.length>0){ // если журнал не пустой, то строим индекс
		lastfailslog.forEach(function(f){
			index[f.nodeid]=f;
		});
	};
	doNodes(conf, // отрабатываем узлы проверки
		function(){
			if(fails.length>0){
				var newfails = fails.filter(function(f){
					return !(f.nodeid in index);
				});
				if(newfails.length>0){
					adminNotification(newfails, function(){
						process.exit(0);
					}, function(){
						process.exit(1);
					});
				};
				saveFailsLog(fails, path, function(){
					process.stdout.write('stop\n');
				}, function(){process.exit(1)});
			};
		},
		function(err){
			process.stderr.write(err.message);
		}
	);
});


// Оповещение админов о произошедших отказах
function adminNotification(newfails, callback, callback_err){
	conf.admins.forEach(function(a){ // Раскидаем отказы по админам
		a.statuses_index = {};
		a.statuses.forEach(function(s){ // индексируем статусы
			a.statuses_index[s] = true;
		});
		a.fails = newfails.filter(function(f){ // отбираем для этого админа только отказы с интересующими его статусами
			return (f.failstatus in a.statuses_index);
		});
	});

	conf.admins.filter(function(a){ // Собираем отказы, группируем по админам подбираем команды
		return (a.fails.length>0);
	}).forEach(function(a){
		while ( a.contacts.length>0 ){
			var c = a.contacts.shift();
			var t = (Object.keys(c))[0];
			var v = c[t];
			var templ = '{' + t + '}';
			var docommands = points.filter(function(p){
				return p.cmd.match(templ);
			}).sort(function(a, b){
				return (a.order || 0)-(b.order || 0);
			})
			.map(function(p){
				var c = p.cmd.replace(templ, v);
				c.match(/\{.+?\}/g).forEach(function(t){
					var sys = t.replace(/^\{/,'').replace(/\}$/,'');
					if(sys in conf.sys){
						c=c.replace(t, conf.sys[sys]);
					}else{
						c=null;
					};
				});
				return c;
			}).filter(function(c){return c});
 			if(docommands.length>0){
				a.docommands = docommands[0];
				a.contacts = [];
			};
		};
	});
	conf.admins.filter(function(a){ // Отправляем оповещения
		return (a.fails.length>0);
	}).forEach(function(a){
		
	});
};


// Загрузка журнала ошибок предыдущей проверки
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
				fails.push({nodeid:cf.md5(node.type + node.ip), failstatus: node.failstatus, type: node.type, ip:node.ip, dt: new Date()});
			};
			process.stdout.write(result.status);
			process.stdout.write(ESC + '0m');
			if(node.note) process.stdout.write('\t\t# ' + node.note + '\n');
			callback(result);
		}, callback_err);
	}else if(node.type=='point'){
		if(node.cmd){
			process.stdout.write('Add alert point: ' + node.cmd + '\n');
			points.push({cmd: node.cmd, order: (node.order || 0)});
		}
		callback(result);
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
	ping.stderr.on('data', (r) => {
		err_mess.push(r.toString());
	});
	ping.on('close', function(code){
		const lines = rows.join('').split(/\n/).filter(function(r){return r;});
		const resstring = lines.filter(function(l){
			return l.match(/packets transmitted.+\d+\% packet loss/);
		})[0];
		if(resstring){
			const m=resstring.match(/(\d+)\% packet loss/);
			if(m[1]>50){
				callback('fail');
			}else{
				callback('ok');
			};
		}else{
			callback('fail');
		};
	});
};
