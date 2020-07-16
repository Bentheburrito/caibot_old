const fs = require('fs');

const logEvent = (text) => {
	console.log(text);
	fs.appendFileSync(__dirname + '/../logs/eventlogs.txt', text + "\n");
}

const logDev = (text) => {
	console.log(text);
	fs.appendFileSync(__dirname + '/../logs/devlogs.txt', text + "\n");
}

const logError = (text, e = '{}') => {
	console.log('\x1b[31m%s\x1b[0m', text);
	console.log(e)
	fs.appendFileSync(__dirname + '/../logs/errorlogs.txt', `${text}\n${e.stack ? e.stack : e}\n`);
}

const logToFile = (text, path) => {

	fs.appendFileSync(path, text + "\n");
}

module.exports = {
	logEvent,
	logDev,
	logError,
	logToFile
}