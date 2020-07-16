const sessionFns = require('../ps2_functions/sessionFunctions.js');

module.exports.time = 5000;
module.exports.run = async (client) => {

	const sessions = JSON.parse(JSON.stringify(client.socketManager.sessionsToSave));
	client.socketManager.sessionsToSave = [];
	sessionFns.saveSessions(client, sessions);
}