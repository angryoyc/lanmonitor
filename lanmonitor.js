#!/usr/bin/node

const conf = require("./config");
const cf = require("cf");
const fs = require("fs");
const async = require("async");
const macros = {};
const fails = [];
const spawn = require('child_process').spawn;

const modules={
	ping:   require("./modules/ping"),
	df:     require("./modules/df"),
	webreq: require("./modules/webreq")
}
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
				process.stdout.write('saveFailsLog\n');
				saveFailsLog(fails, path, function(){
					if(newfails.length>0){
						console.log('Есть ошибки');
						adminNotification(newfails, function(){
							console.log('adminNotification ok');
							process.exit(0);
						}, function(){
							console.log('adminNotification err');
							process.exit(1);
						});
					};
					process.stdout.write('stop\n');
				}, function(){process.exit(1)});
			}else{
				process.stdout.write('removeFailsLog\n');
				removeFailsLog(
					path,
					function(){	process.exit(0)},
					function(){ process.exit(1)}
				);
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
		sendNotification(a.docommands, a.fails, callback, function(err){
				if(err){
					console.log(err.join('\n'));
					callback();
				}else{
					callback();
				}
		});
		/*
		async.forEach(
			a.docommands,
			function(c, cb){
				sendNotification(c, cb, cb);
			},
			function(err){
				if(err){
					console.log(err.join('\n'));
					callback();
				}else{
					callback();
				}
			}
		);
		*/
	});
};


function sendNotification(cmd, fails, callback, callback_err){
	const params = cmd.split(/\s+/);
	const prog = params.shift();
	try{
		const proc = spawn( prog, params );
		const rows = [];
		const err_mess = [];
		proc.stdout.on('data', (r) => { rows.push(r.toString()); });
		proc.stderr.on('data', (r) => { err_mess.push(r.toString()); });
		proc.on('close', function(code){
			const lines = rows.join('').split(/\n/).filter( function(r){return r;} );
			if(code>0){
				console.log(err_mess);
				callback_err();
			}else{
				callback();
			};
		});
		proc.stdin.end(fails.map(function(f){
			return f.module.makeLogRecord(f);
		}).join('\n'));
	}catch(err){
		callback_err(['Tool not found? ' + cmd + ' :: ' + err.message]);
	};
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

function removeFailsLog(path, callback, callback_err){
	fs.unlink(path, function(err){
		if(err){
			callback_err(err);
		}else{
			callback();
		};
	});
};

function doNodes(parent, callback, callback_err){
	if( cf.isArray(parent.nodes) ){
		async.forEachLimit(
			parent.nodes, 1,
			function(node, cb){
				doNode(node, function(status){
					if(status.toLowerCase()=='ok'){
						doNodes(node, cb, callback_err);
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
	if(!node.type){
		callback('ok');
	}else if(node.type=='point'){
		if(node.cmd){
			process.stdout.write('Add alert point: ' + node.cmd + '\n');
			points.push({cmd: node.cmd, order: (node.order || 0)});
		}
		callback('ok');
	}else if(node.type in modules){
		var act = modules[node.type];
		act.test( node, function(status, testresult){
			callback(status);
		}, callback_err, fails);
	}else{
		callback('fail');
	};
};

