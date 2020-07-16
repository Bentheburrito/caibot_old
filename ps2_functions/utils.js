/**
 * @typedef {discord.Channel} Channel
 * @typedef {discord.Message} Message
 */

const { RichEmbed } = require('discord.js');
const request = require('request-promise');
const timeutils = require('../utils/timeutils.js')
const logger = require('../utils/logutils.js');

/**
 * @description Returns a string describing an event with the supplied details.
 * @param {(string|number)} eventState Event state ID
 * @param {string} name Name of the event
 * @param {string} desc Description of the event
 * @param {(string|number)} timestamp Timestamp of event (epoch timestamp)
 * @param {string} zoneName Name of the continent the event is/has taken place
 * @returns {string} string
 */
const newEventDescription = (eventState, name, desc, timestamp, zoneName) => {
	if (!eventState && zoneName) return `${!zoneName ? 'Unknown Continent' : `__**${zoneName}:**__`} No recent event`

	timestamp = parseInt(timestamp) * 1000
	let eventRuntimeMins = Math.round((Date.now() - timestamp) / 1000 / 60);
	let eventRuntime = eventRuntimeMins + " minute(s)";
	if (eventRuntimeMins >= 60) eventRuntime = `${Math.floor(eventRuntimeMins / 60)} hour(s), ${eventRuntimeMins - Math.floor(eventRuntimeMins / 60) * 60} minute(s)`;
	eventRuntime = eventRuntime.replace(', 0 minute(s)', '');
	if (eventRuntime === '0 minute(s)') eventRuntime = 'less than a minute';

	let eventEndtime;
	if (['Enlightenment', 'Liberation', 'Superiority'].some(n => name.includes(n))) eventEndtime = timestamp + 5400000;
	else if (name === 'Aerial Anomalies') eventEndtime = timestamp + 1800000;
	else if (['Refine and Refuel', 'Gaining Ground'].some(n => name === n)) eventEndtime = timestamp + 2700000;
	else eventEndtime = timestamp + 2700000;

	return `${!zoneName ? 'Unknown Continent' : `__**${zoneName}:**__`} **${name}** ${eventState == 135 ? ':arrows_counterclockwise:' : ':no_entry:'}\n${desc}.\n` +
		`${eventState == 135 ? `Ends in **${timeutils.getTimeUntil(eventEndtime - Date.now(), false)}** | Began **${eventRuntime}** ago\n${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'America/Los_Angeles' })} PT / ${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'GMT' })} GMT`
		: `Ended **${eventRuntime}** ago\n${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'America/Los_Angeles' })} PT / ${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'GMT' })} GMT`}`
}

const newStatDescription = (stats, separatorIndices = []) => {
	let index = 0;
	let parsedStats = [];
	for (const stat in stats) {
		if (separatorIndices.includes(index)) parsedStats.push('**--==+==--**');

		title = stat.replace(/([A-Z]+)/g, ' $1').trim();
		parsedStats.push(`**${title.charAt(0).toUpperCase() + title.slice(1)} -** ${stats[stat]}`);
		index++;
	}
	return parsedStats.join('\n');
}

/**
 * 
 * @param {Message} message Prompt message to look for admin reactions on
 * @param {object} emoji_to_WorldID_Map client.emoji_to_WorldID_Map
 */
const getTrackedIDs = async (message, emoji_to_WorldID_Map) => {

	let ids = [];

	for (let reaction of message.reactions) {
		reaction = reaction[1];

		let users = await reaction.fetchUsers();
		let non_bots = users.filter(u => !u.bot);
		let admins = non_bots.filter(async u => {
			m = await message.guild.fetchMember(u);
			if (m.hasPermission('ADMINISTRATOR')) return m;
		});
		let world_id = emoji_to_WorldID_Map[reaction.emoji];

		if (admins.first() != undefined && !!world_id) ids.push(world_id);
	};
	return Promise.resolve(ids);
}

const isLockdownAndSubbed = (row, eventInfo, world_id) =>
	row.event_name.includes("Lockdown") && ["9", "8"].some(id => id === eventInfo.type) && world_id === row.world_id &&
	['Indar', 'Esamir', 'Hossin', 'Amerish'].some(name => name == eventInfo.name.split(' ')[0]);

const notifyEventSubscribers = async (client, eventName, metagame_event_id, world_id, timestamp) => {

	if (!eventName || !world_id) return Promise.reject('eventName or world_id missing.');

	const eventInfo = client.eventInfo.find(e => e.id === metagame_event_id)
	
	const rows = client.eventSubs.filter(r =>
		(eventName === r.event_name && world_id === r.world_id) || isLockdownAndSubbed(r, eventInfo, world_id)
	);
	if (rows.length < 1) return Promise.reject(`No users for event ${eventName}`);

	let users = new Map();
	for (const row of rows) {
		if (!users.has(row)) users.set(row.subscriber_id, { min: Number(row.minTime), max: Number(row.maxTime) });
	}

	let userPMs = [];
	for (const [id, { min, max }] of users) {

		let timezone = client.timezones.has(id) ? client.timezones.get(id).timezone : 'GMT';

		let time = new Date(timestamp).toLocaleTimeString('en-US', { timeZone: timezone, hour12: false }).split(':');
		time = parseInt(time[0] + time[1]);
		while (max < min) { // Untested
			if (time < max) time += 2400
			max += 2400;
		}
		if (time < min || time > max) continue;

		let user = await client.fetchUser(id)
		if (!user) continue;

		userPMs.push(user.send(`**${eventName}** has started on ${client.worldMap[world_id]}!\n${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: timezone })} ${client.timezoneMap[timezone]}`));
	}
	return Promise.all(userPMs);
}

const notifyZoneSubscribers = async (client, zoneName, world_id, timestamp) => {

	if (!zoneName || !world_id) return Promise.reject('continentName or world_id missing.');

	const rows = this.client.eventSubs.filter(r => r.event_name == `${zoneName} Unlock` && r.world_id == world_id);
	if (rows.length < 1) return Promise.reject(`No users for unlock ${zoneName}`);

	let users = new Map();
	for (const row of rows) if (!users.has(row)) users.set(row.subscriber_id, { min: Number(row.minTime), max: Number(row.maxTime) });

	let userPMs = [];
	for (const [id, { min, max }] of users) {

		let timezone = client.timezones.has(id) ? client.timezones.get(id).timezone : 'GMT';

		let time = new Date(timestamp).toLocaleTimeString('en-US', { timeZone: timezone, hour12: false }).split(':');
		time = parseInt(time[0] + time[1]);
		while (max < min) {
			if (time < max) time += 2400;
			max += 2400;
		}
		if (time < min || time > max) continue;

		let user = await client.fetchUser(id);
		if (!user) continue;

		userPMs.push(user.send(`**${zoneName}** has unlocked on ${client.worldMap[world_id]}!\n${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'America/Los_Angeles' })} PT / ${new Date(timestamp).toLocaleTimeString("en-US", { timeZone: 'GMT' })} GMT`));
	}
	return Promise.all(userPMs);
}

const getZoneIDByEventID = (client, eventID) => {
	let info = client.eventInfo.find(info => info.id == eventID);
	if (!info) return console.log(`COULD NOT GET EVENT INFO FOR METAGAME EVENT ID ${eventID}`)
	let zoneID = info.zone_id;
	if (!zoneID) console.log(`COULD NOT GET ZONE ID FROM METAGAME EVENT ID ${eventID}`);
	return zoneID;
}

const getEventByEventID = (eventLogs, eventID, eventToZoneMap) => {
	let keys = Object.keys(eventToZoneMap);
	let values = Object.values(eventToZoneMap);
	let event = eventLogs.find(e => values.some(ids => ids.includes(e.event_id)));

	return event;
}

const format24Hours = (toFormat, addColon = true, returnString = true) => {
	toFormat = Number(toFormat);
	while (toFormat > 2400) toFormat -= 2400;
	while (toFormat < 0) toFormat += 2400;

	let string = toFormat.toString();
	while (string.length < 4) string = '0' + string;
	let pos = string.length - 2
	if (addColon) string = [string.slice(0, pos), ':', string.slice(pos)].join('');
	return returnString ? string : Number(string);
}

const orderedReact = async (message, emojis) => {
	if (!Array.isArray(emojis)) Promise.reject('emojis is not an array')
	for (const emoji of emojis) {
		try { await message.react(emoji) }
		catch (e) {
			if (e.message === 'Unknown Message') {
				console.log(`Couldn't react, the message was deleted.`);
				break;
			}
			console.log(`ERROR when reacting in orderedReact ${e}`);
		}
	}
}

/**
 * @description Create, send, and save a new status message
 * @param {Channel} channel 
 * @returns {Message} Discord.Message
 */
const newStatusMessage = async (client, channel) => {

	const refinedPops = client.uptime > 43200000; // 12h
	const uptimeString = timeutils.getTimeUntil(client.uptime, false);
	let embed = new RichEmbed()
		.setTitle('Server Continents & Events')
		.addField('No servers being tracked', 'React with the options in the prompt to start tracking.')
		.setColor(client.colorMap[Math.floor(Math.random() * client.colorMap.length)])
		.setFooter(`Client uptime: ${uptimeString} - population estimates ${refinedPops ? `should be current` : `may be inaccurate`}.`)

	let statusMessage = await channel.send('', embed).catch(e => console.log('Error sending newStatusMessage' + e));

	client.guildSSData[channel.guild.id].message_id = statusMessage.id;
	
	await client.db.query(`UPDATE guildInfo SET message_id = ? WHERE guild_id = ?`, [statusMessage.id, channel.guild.id]);
	updateGuildData(client);
	return statusMessage;
}

// Returns an updated description for the world.
const getWorldEventDesc = async (client, world_id) => {
	return new Promise(async resolve => {

		let pops = client.worldPops[world_id];
		let totalPop = pops.reduce((total, cur) => cur + total);
		if (totalPop === 0) totalPop = 1;
		let description = `<:vslogo:682819681991917660> ${(100 * pops[1] / totalPop).toFixed(1)}% | <:nclogo:682819604414070791> ${(100 * pops[2] / totalPop).toFixed(1)}% | <:trlogo:682819649838383134> ${(100 * pops[3] / totalPop).toFixed(1)}% | <:nslogo:682859497487859797> ${(100 * pops[4] / totalPop).toFixed(1)}%`;
		if (client.worldZones[world_id].size > 0) {

			for (const [zoneID, event] of client.worldZones[world_id]) {
				let zoneName = client.zoneMap[zoneID];
				description += '\n' + newEventDescription(event.state, event.name, event.description, event.timestamp, zoneName);
			}
			resolve(description + `\n---\n__**Upcoming Continent:**__ ${client.upcomingZones[world_id]} \n**---------------------------------------------------**`);
		}
	});
}

const getZoneStates = async (client, world_id) => {

	let states = {};
	let result = await request({
		url: `${client.queryStart}map?zone_ids=2,4,6,8&world_id=${world_id}&c:join=map_region^inject_at:state^on:Regions.Row[].RowData.RegionId^outer:1^to:map_region_id^terms:facility_type_id=7`,
		json: true
	}).catch(e => console.log(e));
	if (!result || result.error) return logger.logError('census.daybreakgames.com returned an error (or the request failed). - getZoneStates');
	if (result.returned == 0) return;
	
	for (const map of result.map_list) {
		let owners = map.Regions.Row.filter(r => r.RowData.state).map(r => r.RowData.FactionId);
		states[map.ZoneId] = owners.every(id => id === owners[0]) ? 'LOCKED' : 'UNLOCKED';
	}

	return states;
}

const getPromptMessage = async (client, guild_id) => {

	if (!client.guildSSData[guild_id]) return Promise.reject(`No reference to ${guild_id}`)

	let guild = client.guilds.get(guild_id);
	if (!guild) return Promise.reject(`Couldn't find guild with id ${guild_id}. (Error in getPromptMessage(guild_id))`)
	let channel = guild.channels.get(client.guildSSData[guild_id].channel_id)
	if (!channel) return Promise.reject(`Couldn't find channel in guild with id ${guild_id}. (Error in getPromptMessage(guild_id))`)
	let promptMsg = await channel.fetchMessage(client.guildSSData[guild_id].prompt_message_id).catch((e) => { console.log(`Prompt message not found for '${guild.name}'`); });
	if (!promptMsg) {

		let statusMessage = await getStatusMessage(client, guild_id);
		if (statusMessage) statusMessage.delete();

		await client.db.query(`DELETE FROM guildInfo WHERE guild_id = ?;`, [guild_id]).catch(e => console.log(`Error deleting item from guildInfo table: ${e}`));
		updateGuildData(client);
		
		channel.send(`Couldn't find prompt message (possibly deleted), please replace it by using **!ssc <channelName>**`);
		return Promise.reject(`Couldn't find prompt message`);
	}
	return promptMsg;
}

const getStatusMessage = async (client, guild_id) => {

	if (!client.guildSSData[guild_id]) return Promise.reject(`No reference to ${guild_id}`)

	let guild = client.guilds.get(guild_id);
	if (!guild) return Promise.reject(`Couldn't find guild with id ${guild_id}. (Error in getStatusMessage(guild_id))`)
	let channel = guild.channels.get(client.guildSSData[guild_id].channel_id)
	if (!channel) return Promise.reject(`Couldn't find channel in guild with id ${guild_id}. (Error in getStatusMessage(guild_id))`)

	if (client.guildSSData[guild_id].message_id == -1) {
		let statusMessage = await newStatusMessage(client, channel);
		return statusMessage;
	}

	let statusMessage = await channel.fetchMessage(client.guildSSData[guild_id].message_id).catch(() => console.log(`Status message not found for '${guild.name}/${guild.id}' in getStatusMessage, creating a new one`));
	if (!statusMessage) statusMessage = await newStatusMessage(client, channel);

	return statusMessage;
}

const getAllServerStatus_OnLogin = async (client) => {
	const worldIDs = Object.keys(client.worldMap);
	updateWorldZones(client, worldIDs)
		.then(() => getZoneHistory(client, worldIDs));

    for (const guildID in client.guildSSData) {
        
        let promptMsg;
        try { promptMsg = await getPromptMessage(client, guildID) }
		catch (r) { console.log(`Try Catch: getPromptMessage failed (getAllServerStatus_OnLogin): ${r}`); continue; }

        let ids = await getTrackedIDs(promptMsg, client.emoji_to_WorldID_Map);

        client.guildWorldData[guildID].worlds = ids;
        client.updates[guildID] = { worldIDs: ids }
    };
}

const updateWorldZones = async (client, worlds) => {

	if (!Array.isArray(worlds)) return Promise.reject(`worlds is not an array (updateWorldZones)`);
	
	let events = await request({
		url: `${client.queryStart}world_event?&type=METAGAME&c:limit=60&c:lang=en&c:join=metagame_event^inject_at:info&c:tree=field:world_id^list:1`,
		method: 'GET',
		json: true
	}).catch(e => console.log(e));
	if (!events || events.error) return logger.logError('census.daybreakgames.com returned an error (or the request failed). - updateWorldZones');
	events = events.world_event_list[0];
	
	return await Promise.all(worlds.map(id => updateWorldZone(client, id, events[id]))).then(() => console.log('Successfully updated worldZones.'));
}
const updateWorldZone = async (client, world_id, events) => {
	if (!events) return Promise.resolve(); // For Jaeger
	client.worldZones[world_id] = new Map();

	let states = await getZoneStates(client, world_id);

	for (const zone_id in states) {
		if (states[zone_id] === 'LOCKED') continue;

		// If the zone IDs match, e1 is a starting event, and can't find e1's ending event, then this is the currently active event
		let event = events.find(e1 => getZoneIDByEventID(client,
			// If the zone IDs match
			e1.metagame_event_id) == zone_id
			&& // e1 is a starting event
			e1.metagame_event_state == 135
			&& // and can't find e1's ending event
			!events.some(e2 => (e2.instance_id === e1.instance_id && e2.timestamp > e1.timestamp && e2.metagame_event_state != 135)));
		// otherwise try to find the most recently ended event
		if (!event) event = events.find(e1 => getZoneIDByEventID(client, e1.metagame_event_id) == zone_id && e1.metagame_event_state != 135);
		// and if that's not found, just assume this continent recently unlocked and therefore no recent events.
		if (!event) {
			let object = {
				state: undefined,
				instance_id: undefined,
				name: undefined,
				description: undefined,
				timestamp: undefined,
				event_id: undefined
			}
			client.worldZones[world_id].set(zone_id, object);
			continue;
		}

		let object = {
			state: event.metagame_event_state,
			instance_id: event.instance_id,
			name: event.info.name.en,
			description: event.info.description.en,
			timestamp: event.timestamp,
			event_id: event.metagame_event_id
		};
		client.worldZones[world_id].set(zone_id, object);
	}
}

const getZoneHistory = async (client, worlds) => {

	let events = await request({
		url: `${client.queryStart}world_event?type=METAGAME&c:limit=200&c:join=metagame_event^inject_at:info^terms:type=8'type=9^outer:0&c:hide=experience_bonus&c:tree=field:world_id^list:1&c:lang=en`,
		method: 'GET',
		json: true
	}).catch(e => console.log(e));
	if (events.error) return logger.logError('census.daybreakgames.com returned an error (or the request failed). - getZoneHistory');
	events = events.world_event_list[0];

	worlds.forEach(async world_id => {

		let latestEvents = events[world_id];
		if (!latestEvents) return Promise.resolve();

		for (const zone_id of [2, 4, 6, 8]) {

			// Try to find the most recently ended event
			let event = latestEvents.find(e1 => getZoneIDByEventID(client, e1.metagame_event_id) == zone_id && e1.metagame_event_state != 135);
			// and if that's not found, just assume this continent recently unlocked and therefore no recent events.
			if (!event) {
				client.zoneHistory[world_id].set(zone_id, undefined);
				continue;
			}
			client.zoneHistory[world_id].set(zone_id, { timestamp: parseInt(event.timestamp), zone_id });

		}
		
		let lockedZones = Array.from(client.zoneHistory[world_id].values()).filter(z => z && !client.worldZones[world_id].has(z.zone_id.toString()));

		let nextZone = lockedZones.find(zone => lockedZones.every(z => z.timestamp >= zone.timestamp));

		client.upcomingZones[world_id] = nextZone ? client.zoneMap[nextZone.zone_id] : "All Open";
	});
}

// Called on ContinentLock
const rotateZones = async (client, contLockPayload) => {
	if (!client.worldZones[contLockPayload.world_id]) return; // Should only filter out dynamic zones.
	
	const zoneID = contLockPayload.zone_id;

	let history = client.zoneHistory[contLockPayload.world_id];
	history.set(zoneID, { timestamp: contLockPayload.timestamp, zone_id: zoneID });

	let zones = Array.from(history.values()).filter(z => z && !client.worldZones[contLockPayload.world_id].has(z.zone_id.toString()));

	let nextZone = zones.find(zone => zones.every(z => z.timestamp >= zone.timestamp));

	client.upcomingZones[contLockPayload.world_id] = nextZone ? client.zoneMap[nextZone.zone_id] : "All Open";
}

const updateGuildData = async (client) => {
	client.guildSSData = {};
	let data = await client.db.fetch_guildInfo();
	for (const row of data) {
		client.guildSSData[row.guild_id] = { channel_id: row.channel_id, message_id: row.message_id, prompt_message_id: row.prompt_message_id };
		client.guildWorldData[row.guild_id] = { worlds: [] }
	}
}

module.exports = {
	newEventDescription,
	newStatDescription,
	getTrackedIDs,
	notifyEventSubscribers,
	notifyZoneSubscribers,
	getZoneIDByEventID,
	getEventByEventID,
	format24Hours,
	orderedReact,
	newStatusMessage,
	getWorldEventDesc,
	getZoneStates,
	getPromptMessage,
	getStatusMessage,
	getAllServerStatus_OnLogin,
	updateWorldZones,
	getZoneHistory,
	rotateZones,
	updateGuildData
};