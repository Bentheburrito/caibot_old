const { getNewSessions } = require('../ps2_functions/sessionFunctions.js');
const logger = require('../utils/logutils.js');

module.exports.time = 30000;
module.exports.run = async (client) => {
	getNewSessions(client)
		.catch(e => logger.logError('ERROR in getNewSessions.js (timer):', e));
}