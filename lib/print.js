const ESC = '\x1b[';

module.exports = function p(s, color){



	if(!color || (process.env.COLOR=='false')){
		process.stdout.write(s.toString());
	}else{
		if(color=='red') {
			process.stdout.write(ESC + '31m');
			process.stdout.write(s.toString());
			process.stdout.write(ESC + '0m');
		}else if(color=='green'){
			process.stdout.write(ESC + '32m');
			process.stdout.write(s.toString());
			process.stdout.write(ESC + '0m');
		}else{
			process.stdout.write(s.toString());
		};
	};
};
