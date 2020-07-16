const sessionFns = require('../ps2_functions/sessionFunctions.js');
let startAtIndex = 0;

// Calls archiveSessions every minute.
module.exports.time = 45000;
module.exports.run = async (client) => {
	startAtIndex = await sessionFns.archiveSessions(client, startAtIndex).catch(e => console.log(`ERR archiveSessions - sessionFns.archiveSessions returned an error: ${e}`));
}
