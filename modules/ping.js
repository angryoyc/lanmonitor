#!/usr/bin/node
const cf = require("cf");
const spawn = require('child_process').spawn;
const ESC = '\x1b[';
const threshold = 50; // максимально допустимое количество потерянных пакетов (%)

exports.test=function(conf, callback, callback_err, fails){
	const params = [conf.ip, '-c', 2];
	try{
		const ping = spawn((conf.sys?conf.sys.ping:'') || 'ping' , params);
		const rows = [];
		const err_mess = [];
		process.stdout.write('Pinging to host ' + conf.ip + ' ... ');
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
					process.stdout.write(ESC + '31m');
					process.stdout.write('fail');
					process.stdout.write(ESC + '0m');
					fails.push( exports.failDescription(conf, {testno: 2, test: "Количество потерянных пакетов.", threshold: threshold, value: m[1], ip: conf.ip}) );
					if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
					callback('fail');
				}else{
					process.stdout.write(ESC + '32m');
					process.stdout.write('ok');
					process.stdout.write(ESC + '0m');
					if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
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
	return  fail.dt.toString() +  ' ping to ' + fail.testresult.ip  + ' :: ' + fail.failstatus + ' :: ' + fail.testresult.test + ' порог: ' + threshold + ' значение: ' + fail.testresult.value + ' status: failed';
};