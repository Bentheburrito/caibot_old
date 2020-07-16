const WebSocket = require('ws');
const { RichEmbed } = require('discord.js');

const ps2 = require('../ps2_functions/utils.js');
const timeutils = require('../utils/timeutils.js')

module.exports.time = 5000;
module.exports.run = async (client) => {

    // Check if the object is empty.
    if (Object.entries(client.updates).length === 0 && client.updates.constructor === Object || !client.socketManager) return;
    if (client.socketManager.censusSocket.readyState !== WebSocket.OPEN) {
		console.log(`client.socketManager not open (${client.socketManager.readyState}), returning from applyUpdates(client)`);
		return;
    }

	for (var guildID in client.updates) {
		
        // loop through array with edited data, apply to message
        let guildData = client.guildSSData[guildID];
		if (!guildData) {
			delete client.updates[guildID]
			continue;
		}
        // Collect info from the updates object and clear them.

        // ******As of this note, message is only being used to channel.stopTyping, and we can get the channel from statusMessage so this may be obsolete
        let worldIDs = client.updates[guildID].worldIDs;
        delete client.updates[guildID]

        // Fetch the statusMessage (where the server status is actually held)
		let statusMessage = await ps2.getStatusMessage(client, guildID).catch(r => console.log('Rejected : ' + r));
		if (!statusMessage) {
			console.log(`getStatusMessage(${guildID}) returned 'undefined' because there is no prompt message.`);
			continue;
		}

        client.guildWorldData[guildID] = { worlds: worldIDs };
		
        // Reconstruct Embed (to be able to use .addField and other functions)
        var embed = statusMessage.embeds[0];
        embed = new RichEmbed({
            title: embed.title,
            color: embed.color,
            fields: embed.fields
        });
        
        // If there are no selected servers, remove all server fields.
        if (worldIDs.length < 1) {
            embed.fields = embed.fields.filter(() => false)
			embed.addField('No servers being tracked', 'React with the options in the prompt to start tracking.');
        }
        // Otherwise, for each id...
        else {
            for (var world_id of worldIDs) {

				let description = (await ps2.getWorldEventDesc(client, world_id)).slice(0, 1024);
				let title = client.worldMap[world_id] + ' :busts_in_silhouette: ' + client.worldPops[world_id].reduce((total, cur) => cur + total);
                // ...if a field being tracked already exists on the embed, edit/update it, otherwise add a field.
                if (embed.fields.some(f => f.name.includes(client.worldMap[world_id]))) {

                    let field = embed.fields.find(f => f.name.includes(client.worldMap[world_id])); 
					field.value = description;
					field.name = title;
                } else embed.addField(title, description)
                
                // If a server that's not being tracked has a field on the embed, remove it.
                if (embed.fields.some(f => !worldIDs.includes(parseInt(Object.keys(client.worldMap).find(k => f.name.includes(client.worldMap[k])))))) {
                    embed.fields = embed.fields.filter(f => f.name.includes(client.worldMap[world_id]))
                }
            };
        }
        // Sort the fields.
        let keys = Object.keys(client.worldMap);
		embed.fields.sort((a, b) => keys.find(key => a.name.includes(client.worldMap[key])) > keys.find(key => b.name.includes(client.worldMap[key])))

		// Update the footer.
		const uptimeString = timeutils.getTimeUntil(client.uptime, false);
		const footer = `Session uptime: ${uptimeString}. Population estimates ${client.sessionsReloaded ? `should be accurate` : `need time to sync`}.`
		if (!embed.footer) embed.setFooter(footer);
		else embed.footer.text = footer;

        // Stop typing in the channel to show editing is done.
        statusMessage.channel.stopTyping(true);
        // Edit the message with the new embed.
        statusMessage.edit('', embed)
            .catch(e => console.log('Could not statusMessage.edit() - ' + e));
    }
}
