#!/usr/bin/node
const cf = require("cf");
const moment = require("moment");
const spawn = require('child_process').spawn;
const ESC = '\x1b[';

exports.test=function(conf, callback, callback_err, fails){
	const params = [conf.ssh, 'cat /proc/drbd | grep [0-9]\:'];
	try{
		const ssh = spawn((conf.sys?conf.sys.ssh:'') || 'ssh' , params);
		const rows = [];
		const err_mess = [];
		process.stdout.write('Test DRBD-status on ' + conf.ssh + ' ...');
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
				process.stdout.write(ESC + '31m');
				process.stdout.write('fail');
				process.stdout.write(ESC + '0m');
				fails.push( exports.failDescription(conf, {testno: 2, test: "DRBD-стаtus", ssh: conf.ssh}) );
				if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
				callback('fail');
			}else{
				//ok
				process.stdout.write(ESC + '32m');
				process.stdout.write('ok');
				process.stdout.write(ESC + '0m');
				if(conf.note) process.stdout.write('\t\t# ' + conf.note + '\n');
				callback('ok');
			};
			/*
			const lines = rows.join('').split(/\n/).filter(function(r){return r;}).filter(function(r){return r.match(conf.blk);});
			const resstring = lines.filter(function(l){
				return l.match(/(.+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\%/);
			})[0];
			if(resstring){
				const m = resstring.match(/(.+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\%/);
				process.stdout.write( ' (' + m[5] + ' < ' + conf.threshold + ') ' );
				if(m[5]>conf.threshold){
					process.stdout.write(ESC + '31m');
					process.stdout.write('fail');
					process.stdout.write(ESC + '0m');
					fails.push( exports.failDescription(conf, {testno: 2, test: "Процент использованного пространства.", threshold: threshold, value: m[5], ssh: conf.ssh}) );
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
				fails.push( exports.failDescription(conf, {testno: 1, test: "Формат выдаваемых сообщений", ip: conf.ssh}) );
				callback('fail');
			};
			*/
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
