const { saveSession } = require('../ps2_functions/sessionFunctions.js');
const logger = require('../utils/logutils.js');

module.exports.time = 60000;
module.exports.run = async (client) => {

	if (!client.socketManager) return logger.logDev('No socket manager, cancelling idle timeouts.');

	const sessions = client.socketManager.activeSessions;
	if (sessions.size === 0) return logger.logDev('activeSession empty, cancelling idle timeouts.');

	for (const [character_id, session] of sessions) {
		if (session.latestAction < (Date.now() / 1000) - 1800) {
			session.logoutTimestamp = session.latestAction - 1800;
			
			await saveSession(client, session);
			client.socketManager.activeSessions.delete(character_id);

			if (client.worldPops[session.worldID][session.factionID] > 0) client.worldPops[session.worldID][session.factionID]--;
		}
	}
}