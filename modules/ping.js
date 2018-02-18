#!/usr/bin/node
const cf = require("cf");
const moment = require("moment");
const print = require('../lib/print.js');
const spawn = require('child_process').spawn;
const threshold = 50; // максимально допустимое количество потерянных пакетов (%)

exports.test=function(conf, callback, callback_err, fails){
	const params = [conf.ip, '-c', 5];
	try{
		const ping = spawn((conf.sys?conf.sys.ping:'') || 'ping' , params);
		const rows = [];
		const err_mess = [];
		print('Pinging to host ' + conf.ip + ' ... ');
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
				if(m[1]>threshold){
					print('fail', 'red');
					fails.push( exports.failDescription(conf, {testno: 2, test: "Количество потерянных пакетов.", threshold: threshold, value: m[1], ip: conf.ip}) );
					if(conf.note) print('\t\t# ' + conf.note );
					print('\n');
					callback('fail');
				}else{
					print('ok', 'green');
					if(conf.note) print('\t\t# ' + conf.note );
					print('\n');
					callback('ok');
				};
			}else{
				fails.push( exports.failDescription(conf, {testno: 1, test: "Формат выдаваемых сообщений", ip: conf.ip}) );
				callback('fail');
			};
		});
	}catch(e){
		fails.push( exports.failDescription(conf, {testno: 0, test: "Наличие и работоспособность утилиты тестирования (ping)"}) );
		callback('fail');
	};
};


// Формирование записи об откаже. Первые 5 свойств обязательны.
exports.failDescription=function(conf, data){
	return {
		nodeid: cf.md5(conf.type + conf.ip),
		failstatus: conf.failstatus,
		type: conf.type,
		dt: new Date(),
		module: exports,
		testresult: data
	};
};

// Формирование записи в журнал отказов (на основе данных тестирования)
exports.makeLogRecord=function(fail){
	if(fail.testresult.testno==0){
		return  format(fail.dt) + ' ping :: ' + fail.failstatus + ' :: ' + fail.testresult.test +  ' ошибка запуска внешней утилиты ' + fail.testresult.value + ' status: failed';
	}else if(fail.testresult.testno==1){
		return  format(fail.dt) +  ' ping to ' + fail.testresult.ip  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' нераспознан ' + fail.testresult.value + ' status: failed';
	}else if(fail.testresult.testno==2){
		return format(fail.dt) +  ' ping to ' + fail.testresult.ip  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' порог: ' + threshold + ' значение: ' + fail.testresult.value + ' status: failed';
	}else{
		return format(fail.dt) +  ' ping status: failed';
	};
};

function format(dt){
	return moment(dt).format("YYYY-MM-DD HH:mm:ss");
};