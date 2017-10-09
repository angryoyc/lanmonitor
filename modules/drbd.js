#!/usr/bin/node
const cf = require("cf");
const moment = require("moment");
const print = require('../lib/print.js');
const spawn = require('child_process').spawn;

exports.test=function(conf, callback, callback_err, fails){
	const params = [conf.ssh, 'cat /proc/drbd | grep [0-9]\:'];
	try{
		const ssh = spawn((conf.sys?conf.sys.ssh:'') || 'ssh' , params);
		const rows = [];
		const err_mess = [];
		print('Test DRBD-status on ' + conf.ssh + ' ...');
		ssh.stdout.on('data', (r) => {
			var a = r.toString().split(/\n/);
			while(a.length>0){
				var s=a.shift();
				if(s) rows.push(s);
			};
		});
		ssh.stderr.on('data', (r) => {
			err_mess.push(r.toString());
		});
		ssh.on('close', function(code){
			//console.log(rows);
			var ok_counter = rows.filter(function(s){
				return s.match(/UpToDate\/UpToDate/);
			}).length;
			if(ok_counter < rows.length){
				//fail
				print('fail', 'red');
				fails.push( exports.failDescription(conf, {testno: 2, test: "DRBD-стаtus", ssh: conf.ssh}) );
				if(conf.note) print('\t\t# ' + conf.note + '\n');
				callback('fail');
			}else{
				//ok
				print('ok', 'green');
				if(conf.note) print('\t\t# ' + conf.note + '\n');
				callback('ok');
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
		return format(fail.dt) +  ' ssh df to ' + fail.testresult.ssh  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' порог: ' + threshold + ' значение: ' + fail.testresult.value + ' status: failed';
	}else{
		return format(fail.dt) +  ' ssh df status: failed';
	};
};

function format(dt){
	return moment(dt).format("YYYY-MM-DD HH:mm:ss");
};
