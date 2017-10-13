#!/usr/bin/node
const cf = require("cf");
const moment = require("moment");
const spawn = require('child_process').spawn;
const print = require('../lib/print.js');

exports.test=function(conf, callback, callback_err, fails){
	const params = [conf.ssh, 'df'];
	try{
		const ssh = spawn((conf.sys?conf.sys.ssh:'') || 'ssh' , params);
		const rows = [];
		const err_mess = [];
		print('Test free space on ' + conf.ssh + ' : '  + conf.blk + ' ...');
		ssh.stdout.on('data', (r) => {
			rows.push(r.toString());
		});
		ssh.stderr.on('data', (r) => {
			err_mess.push(r.toString());
		});
		ssh.on('close', function(code){
			const lines = rows.join('').split(/\n/).filter(function(r){return r;}).filter(function(r){return r.match(conf.blk);});
			const resstring = lines.filter(function(l){
				return l.match(/(.+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\%/);
			})[0];
			if(resstring){
				const m = resstring.match(/(.+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\%/);
				print( ' (' + m[5] + ' < ' + conf.threshold + ') ' );
				if(m[5]>conf.threshold){
					print('fail', 'red');
					fails.push( exports.failDescription(conf, {testno: 2, test: "Процент использованного пространства.", threshold: conf.threshold, value: m[5], ssh: conf.ssh}) );
					if(conf.note) print('\t\t# ' + conf.note + '\n');
					callback('fail');
				}else{
					print('ok', 'green');
					if(conf.note) print('\t\t# ' + conf.note + '\n');
					callback('ok');
				};
			}else{
				fails.push( exports.failDescription(conf, {testno: 1, test: "Формат выдаваемых сообщений", ip: conf.ssh}) );
				callback('fail');
			};
		});
	}catch(e){
		fails.push( exports.failDescription(conf, {testno: 0, test: "Наличие и работоспособность утилиты тестирования (ssh)"}) );
		callback('fail');
	};
};

// Формирование записи об откаже. Первые 5 свойств обязательны.
exports.failDescription=function(conf, data){
	return {
		nodeid: cf.md5(conf.type + conf.ssh),
		failstatus: conf.failstatus,
		type: conf.type,
		dt: new Date(),
		threshold: conf.threshold,
		module: exports,
		testresult: data
	};
};

// Формирование записи в журнал отказов (на основе данных тестирования)
exports.makeLogRecord=function(fail){
	if(fail.testresult.testno==0){
		return  format(fail.dt) + ' ssh df :: ' + fail.failstatus + ' :: ' + fail.testresult.test +  ' ошибка запуска внешней утилиты ' + fail.testresult.value + ' status: failed';
	}else if(fail.testresult.testno==1){
		return  format(fail.dt) +  ' ssh df ' + fail.testresult.ssh  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' не распознан ' + fail.testresult.value + ' status: failed';
	}else if(fail.testresult.testno==2){
		return format(fail.dt) +  ' ssh df to ' + fail.testresult.ssh  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' порог: ' + fail.threshold + ' значение: ' + fail.testresult.value + ' status: failed';
	}else{
		return format(fail.dt) +  ' ssh df status: failed';
	};
};

function format(dt){
	return moment(dt).format("YYYY-MM-DD HH:mm:ss");
};
