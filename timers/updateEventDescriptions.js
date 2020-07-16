const ps2 = require('../ps2_functions/utils.js');

module.exports.time = 60000;
module.exports.run = async (client) => {

    for (let guildID in client.guildSSData) {

		let promptMsg;
        try { promptMsg = await ps2.getPromptMessage(client, guildID) }
		catch (r) { console.log(`Try Catch: getPromptMessage failed (updateEventDescriptions): ${r}`); continue; }

        let ids = await ps2.getTrackedIDs(promptMsg, client.emoji_to_WorldID_Map)
        client.updates[guildID] = { worldIDs: ids }
    }
};