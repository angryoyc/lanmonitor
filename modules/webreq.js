#!/usr/bin/node
const cf = require("cf");
const web = require("web");
const moment = require("moment");
const spawn = require('child_process').spawn;
const ESC = '\x1b[';
const threshold = 50; // максимально допустимое количество потерянных пакетов (%)

exports.test=function(conf, callback, callback_err, fails){
	process.stdout.write('Http request to URI ' + conf.url + ' ... ');
	const method = (conf.method || 'get').toLowerCase();
	if(method=='get'){
		web.get(conf.url)
		.then(function(result){
			if(conf.result && conf.result!=result){
				process.stdout.write( ESC + '31m' );
				process.stdout.write( 'fail' );
				process.stdout.write( ESC + '0m' );
				fails.push( exports.failDescription(conf, {testno: 1, test: "Ответ не соответствует ожиданиям", url: conf.url, result: result, wasexpected: conf.result}) );
				if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
				callback('fail');
			}else{
				process.stdout.write( ESC + '32m' );
				process.stdout.write( 'ok' );
				process.stdout.write( ESC + '0m' );
				if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
				callback('ok');
			};
		})
	}else{
		process.stdout.write( ESC + '31m' );
		process.stdout.write( 'fail' );
		process.stdout.write( ESC + '0m' );
		fails.push( exports.failDescription(conf, {testno: 0, test: "Формат данных узла" }) );
		if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
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