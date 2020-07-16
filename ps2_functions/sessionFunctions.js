const request = require('request-promise');
const { cloneArray } = require('../ps2_functions/misc.js');
const logger = require('../utils/logutils.js');

/**
 * @typedef { sessionTemplate } GameSession
 */

// All of the following are on a per login/logout
const sessionTemplate = {
	character_id: undefined,
	name: "null name",
	kills: 0, // Total player kills 
	killsHS: 0, // Total headshot kills 
	killsIvI: 0, // Infantry vs Infantry kills (no vehicles involved)
	killsHSIvI: 0, // Infantry vs Infantry headshot kills
	deaths: 0, // Total deaths 
	deathsIvI: 0, // Total Infantry vs Infantry deaths
	vehicleKills: 0, // Total vehicle kills excluding owned vehicles
	vehicleDeaths: 0, // Total owned vehicles destroyed
	vehicleBails: 0, // Number of times an owned vehicle is destroyed where the owner lives at least 10 seconds afterward.
	nanitesLost: 0, // Number of nanites spent
	nanitesKilled: 0, // Number of nanites in vehicles destroyed excluding owned vehicles
	vehiclesKilled: [], // List of enemy vehicle names and amounts that were destroyed {name: name, amount: amount}
	vehiclesLost: [], // List of owned vehicle names and amounts that were destroyed {name: name, amount: amount}
	xpTypes: [], // List of experience_ids and amounts {experience_id: id, amount: amount}
	xpEarned: 0, // Total XP earned 
	baseCaps: 0, // Facilities captured
	baseDefs: 0, // Facilities defended
	factionID: 0, // Character's faction ID
	latestDeath: 0, // Timestamp of the latest death
	latestVehicleLost: 0, // Timestamp of the latest vehicle destroyed (not actually used right now)
	latestAction: 0, // Timestamp of the latest packet received involving this character (used to determine if the player logged out without a PlayerLogout event).
	/**
	 * shotsFired and shotsHit are used to track improvement per session.
	 * For example, the value stored is [shots fired at the end of the session (according to the API)] - [shots fired at the beginning of the session] = [shots fired during the session]. 
	 * These values will then be used to calculate accuracy, shots per kill (SPK), etc.
	 * In theory, if the API updates a character's total shots_fired and shots_hit fields in a timely manner this will provide an accurate estimate for session accuracy.
	 */
	shotsFired: 0, // Amount of shots at the beginning of the session
	shotsHit: 0, // Amount of hits at the beginning of the session

	loginTimestamp: null, // Session login time
	logoutTimestamp: null, // Session logout time
	worldID: null
}

/**
 * @param {import('discord.js-commando').CommandoClient} client The client.
 * @param {import('../managers/SocketManager.js')} socketManager The main socket manager
 */
const getNewSessions = async (client) => {

	let character_info = client.socketManager.pendingSessions;
	if (character_info.length < 1) return;

	character_info = cloneArray(character_info);
	client.socketManager.pendingSessions = [];

	// API Query
	let allCharStats = await request({
		url: `${client.queryStart}character/?character_id=${character_info.map(info => info[0]).join(',')}&c:show=character_id,name,faction_id&c:join=characters_weapon_stat^list:1^inject_at:weapon_shot_stats^show:stat_name'item_id'vehicle_id'value^terms:stat_name=weapon_hit_count'stat_name=weapon_fire_count'vehicle_id=0'item_id=!0(item^inject_at:weapon^show:name.en'item_category_id^terms:item_category_id=3'item_category_id=5'item_category_id=6'item_category_id=7'item_category_id=8'item_category_id=12'item_category_id=19'item_category_id=24'item_category_id=100'item_category_id=102)`,
		json: true
	}).catch(e => console.log(`Request error in sessionFunctions - ${e}`));

	// Data checks
	if (!allCharStats || allCharStats.error) return console.log('census.daybreakgames.com returned an error in sessionFunctions.getNewSessions.');
	if (allCharStats.returned == 0) return console.log(`getNewSessions() - something went wrong, charStats.returned == 0!`);

	for (const [character_id, startTimestamp, world_id] of character_info) {

		let charStats = allCharStats.character_list.find(c => c.character_id == character_id);
		if (!charStats) {
			client.socketManager.pendingSessions.push([character_id, startTimestamp, world_id]);
			continue;
		}

		let newSession = JSON.parse(JSON.stringify(sessionTemplate));
		newSession.loginTimestamp = startTimestamp;
		if (Array.isArray(charStats.weapon_shot_stats)) {
			for (const item of charStats.weapon_shot_stats) {
				if (item.weapon && item.stat_name === 'weapon_fire_count') newSession.shotsFired += parseInt(item.value);
				else if (item.weapon && item.stat_name === 'weapon_hit_count') newSession.shotsHit += parseInt(item.value);
			}
		} else newSession.shotsFired = newSession.shotsHit = 0;

		newSession.character_id = charStats.character_id;
		newSession.name = charStats.name.first;
		newSession.factionID = charStats.faction_id;
		newSession.worldID = world_id;
		newSession.latestAction = startTimestamp;

		if (!client.worldPops[world_id]) logger.logEvent(`client.worldPops[world_id: ${world_id}] doesn't exist`);
		// Increment faction pop
		client.worldPops[world_id][newSession.factionID]++;
		
		// Add to activeSessions
		client.socketManager.activeSessions.set(character_id, newSession);

		if (!client.socketManager.queue[character_id]) continue;
		// If there are any payloads pertaining to character_id, they will be in queue[character_id].
		// So pass all of those queued payloads to the handler and delete the queue
		for (const payload of client.socketManager.queue[character_id]) {
			client.socketManager.handlePayload(client, payload);
		}
		delete client.socketManager.queue[character_id];
	}
}

/**
 * @description Checks the Census API for updates on shotsFired & shotsHit, then updates DB rows and archives the session.
 * @param {Object} client The client object.
 * @returns {void}
 */
const archiveSessions = async (client, startAtIndex = 0) => {

	const sessionList = await client.db.query(`SELECT * FROM latestGameSessions WHERE archived = 0 ORDER BY logoutTimestamp ASC LIMIT ?, 350;`, [startAtIndex])
		.catch(e => console.log(e));
	if (!sessionList || sessionList.length == 0) return startAtIndex;

	let charList = await request({
		url: `${client.queryStart}character/?character_id=${sessionList.map(s => s.character_id).join(',')}&c:show=character_id,times.last_save&c:join=characters_weapon_stat^list:1^inject_at:weapon_shot_stats^show:stat_name'item_id'vehicle_id'value^terms:stat_name=weapon_hit_count'stat_name=weapon_fire_count'vehicle_id=0'item_id=!0(item^inject_at:weapon^show:name.en'item_category_id^terms:item_category_id=3'item_category_id=5'item_category_id=6'item_category_id=7'item_category_id=8'item_category_id=12'item_category_id=19'item_category_id=24'item_category_id=100'item_category_id=102)`,
		json: true
	}).catch(e => console.log(e));

	// Data checks
	if (!charList || charList.error) {
		console.error('census.daybreakgames.com returned an error in sessionFunctions.archiveSessions()');
		return startAtIndex;
	}
	if (parseInt(charList.returned) < sessionList.length) {
		console.log('returned: ' + charList.returned);
		let badSessions = sessionList.filter(session => !charList.character_list.map(char => char.character_id).includes(session.character_id));
		console.log(`Deleting bad sessions with IDs: ${badSessions.map(s => s.character_id)}`);
		await client.db.query(`DELETE FROM latestGameSessions WHERE ${'character_id = ? OR '.repeat(badSessions.length).slice(0, -4)};`, badSessions.map(s => s.character_id))
	}

	let archivedIDs = []; // Temp - Only used for logging
	charList = charList.character_list;

	for (const session of sessionList) {

		let charStats = charList.find(c => c.character_id == session.character_id);
		if (!charStats) continue;

		session.logoutTimestamp = parseInt(session.logoutTimestamp); // DB returns a string.

		// min = -3, max = 3
		const diff = charStats.times.last_save - session.logoutTimestamp;
		if ((diff - -3) * (diff - 3) > 0 && diff < 3) continue;

		let shotsFiredEnd = 0;
		let shotsHitEnd = 0;

		if (Array.isArray(charStats.weapon_shot_stats)) {

			for (const item of charStats.weapon_shot_stats) {

				if (item.weapon && item.stat_name === 'weapon_fire_count') shotsFiredEnd += parseInt(item.value);
				else if (item.weapon && item.stat_name === 'weapon_hit_count') shotsHitEnd += parseInt(item.value);
			}
		} else shotsFiredEnd = shotsHitEnd = 0;

		const continueWaiting = (Date.now() / 1000) < (session.logoutTimestamp + 3600);
		if (shotsFiredEnd - session.shotsFired === 0 && continueWaiting) continue;

		session.shotsFired = shotsFiredEnd - session.shotsFired > 0 ? shotsFiredEnd - session.shotsFired : 0;
		session.shotsHit = shotsHitEnd - session.shotsHit > 0 ? shotsHitEnd - session.shotsHit : 0;

		await client.db.query(`UPDATE latestGameSessions SET archived = 1, shotsFired = ?, shotsHit = ? WHERE character_id = ?;`, [session.shotsFired, session.shotsHit, session.character_id])
			.catch(e => console.log(e));

		archivedIDs.push(session.character_id);
	}
	if (archivedIDs.length > 0) console.log('\x1b[32m%s\x1b[0m', `Updated and archived ${archivedIDs.length} session(s) with IDs: ${archivedIDs.join(', ')}`);
	return sessionList.length < 350 ? 0 : startAtIndex + 350; // May want to turn this into `startAtIndex + 350 - archivedIDs.length;` at some point.
}

/**
 * @description Save a GameSession to the DB.
 * @param {Object} client The client object.
 * @param {GameSession} session The session to save.
 * @returns {Promise<Boolean>} True if the session was saved successfully.
 */
const saveSession = async (client, session) => {

	if (!session) return false;

	// Check if the session counts (Extract into seperate method?)
	if (session.xpEarned === 0) return false;

	const mainStats = [session.character_id, session.name, session.kills, session.killsHS, session.killsIvI, session.killsHSIvI, session.deaths, session.deathsIvI, session.vehicleKills, session.vehicleDeaths, session.vehicleBails, session.nanitesLost, session.nanitesKilled, session.xpEarned, session.baseCaps, session.baseDefs, session.factionID, session.shotsFired, session.shotsHit, session.loginTimestamp, session.logoutTimestamp, 0];
	const mainStatsParams = '(character_id, name, kills, killsHS, killsIvI, killsHSIvI, deaths, deathsIvI, vehicleKills, vehicleDeaths, vehicleBails, nanitesLost, nanitesKilled, xpEarned, baseCaps, baseDefs, factionID, shotsFired, shotsHit, loginTimestamp, logoutTimestamp, archived)';

	await client.db.query(`INSERT INTO totalGameSessions ${mainStatsParams} SELECT l.character_id, l.name, l.kills, l.killsHS, l.killsIvI, l.killsHSIvI, l.deaths, l.deathsIvI, l.vehicleKills, l.vehicleDeaths, l.vehicleBails, l.nanitesLost, l.nanitesKilled, l.xpEarned, l.baseCaps, l.baseDefs, l.factionID, l.shotsFired, l.shotsHit, l.loginTimestamp, l.logoutTimestamp, 0 FROM latestGameSessions l WHERE l.character_id = ? ON DUPLICATE KEY UPDATE kills = totalGameSessions.kills + l.kills, killsHS = totalGameSessions.killsHS + l.killsHS, killsIvI = totalGameSessions.killsIvI + l.killsIvI, killsHSIvI = totalGameSessions.killsHSIvI + l.killsHSIvI, deaths = totalGameSessions.deaths + l.deaths, deathsIvI = totalGameSessions.deathsIvI + l.deathsIvI, vehicleKills = totalGameSessions.vehicleKills + l.vehicleKills, vehicleDeaths = totalGameSessions.vehicleDeaths + l.vehicleDeaths, vehicleBails = totalGameSessions.vehicleBails + l.vehicleBails, nanitesLost = totalGameSessions.nanitesLost + l.nanitesLost, nanitesKilled = totalGameSessions.nanitesKilled + l.nanitesKilled, xpEarned = totalGameSessions.xpEarned + l.xpEarned, baseCaps = totalGameSessions.baseCaps + l.baseCaps, baseDefs = totalGameSessions.baseDefs + l.baseDefs, shotsFired = CASE WHEN l.archived = 1 THEN totalGameSessions.shotsFired + l.shotsFired ELSE totalGameSessions.shotsFired END, shotsHit = CASE WHEN l.archived = 1 THEN totalGameSessions.shotsHit + l.shotsHit ELSE totalGameSessions.shotsHit END, logoutTimestamp = l.logoutTimestamp;`, [session.character_id])
		.catch(e => console.log(`ERROR SAVING TO totalGameSessions (new entries): ${e}`));

	client.db.query(`INSERT INTO latestGameSessions ${mainStatsParams} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE kills = VALUES(kills), killsHS = VALUES(killsHS), killsIvI = VALUES(killsIvI), killsHSIvI = VALUES(killsHSIvI), deaths = VALUES(deaths), deathsIvI = VALUES(deathsIvI), vehicleKills = VALUES(vehicleKills), vehicleDeaths = VALUES(vehicleDeaths), vehicleBails = VALUES(vehicleBails), nanitesLost = VALUES(nanitesLost), nanitesKilled = VALUES(nanitesKilled), xpEarned = VALUES(xpEarned), baseCaps = VALUES(baseCaps), baseDefs = VALUES(baseDefs), factionID = VALUES(factionID), shotsFired = VALUES(shotsFired), shotsHit = VALUES(shotsHit), loginTimestamp = VALUES(loginTimestamp), logoutTimestamp = VALUES(logoutTimestamp), archived = 0;`, mainStats)
		.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS: ${e}`));
	
	if (session.vehiclesKilled.length > 0) {
		await client.db.query('DELETE FROM latestGameSessions_vehiclesKilled WHERE character_id = ?', [session.character_id])
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS vehiclesKilled: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_vehiclesKilled (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(session.vehiclesKilled.length).slice(0, -1)};`, session.vehiclesKilled.map(vehicle => [session.character_id, vehicle.name, vehicle.amount]).flat())
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS vehiclesKilled: ${e}`));
	}
	if (session.vehiclesLost.length > 0) {
		await client.db.query('DELETE FROM latestGameSessions_vehiclesLost WHERE character_id = ?', [session.character_id])
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS vehiclesLost: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_vehiclesLost (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(session.vehiclesLost.length).slice(0, -1)};`, session.vehiclesLost.map(vehicle => [session.character_id, vehicle.name, vehicle.amount]).flat())
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS vehiclesLost: ${e}`));
	}
	if (session.xpTypes.length > 0)	{
		await client.db.query('DELETE FROM latestGameSessions_xpTypes WHERE character_id = ?', [session.character_id])
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS xpTypes: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_xpTypes (character_id, experience_id, amount, timestamp) VALUES ${'(?, ?, ?, ?),'.repeat(session.xpTypes.length).slice(0, -1)};`, session.xpTypes.map(type => [session.character_id, type.experience_id, type.amount, Math.floor(Date.now() / 1000)]).flat())
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS xpTypes: ${e}`));
	}
	return true;
}

const saveSessions = async (client, sessions) => {

	if (!sessions) return false;

	sessions = sessions.filter(session => session.xpEarned > 0);
	if (sessions.length === 0) return false;

	const mainStats = sessions.map(session => [session.character_id, session.name, session.kills, session.killsHS, session.killsIvI, session.killsHSIvI, session.deaths, session.deathsIvI, session.vehicleKills, session.vehicleDeaths, session.vehicleBails, session.nanitesLost, session.nanitesKilled, session.xpEarned, session.baseCaps, session.baseDefs, session.factionID, session.shotsFired, session.shotsHit, session.loginTimestamp, session.logoutTimestamp, 0]).flat();
	const mainStatsCharIDs = sessions.map(session => session.character_id);
	const vehiclesKilledStats = sessions.map(session => session.vehiclesKilled.map(vehicle => [session.character_id, vehicle.name, vehicle.amount])).flat(2);
	const vehiclesLostStats = sessions.map(session => session.vehiclesLost.map(vehicle => [session.character_id, vehicle.name, vehicle.amount])).flat(2);
	const xpTypesStats = sessions.map(session => session.xpTypes.map(type => [session.character_id, type.experience_id, type.amount, Math.floor(Date.now() / 1000)])).flat(2);
	const mainStatsParams = '(character_id, name, kills, killsHS, killsIvI, killsHSIvI, deaths, deathsIvI, vehicleKills, vehicleDeaths, vehicleBails, nanitesLost, nanitesKilled, xpEarned, baseCaps, baseDefs, factionID, shotsFired, shotsHit, loginTimestamp, logoutTimestamp, archived)';

	await client.db.query(`INSERT INTO totalGameSessions ${mainStatsParams} SELECT l.character_id, l.name, l.kills, l.killsHS, l.killsIvI, l.killsHSIvI, l.deaths, l.deathsIvI, l.vehicleKills, l.vehicleDeaths, l.vehicleBails, l.nanitesLost, l.nanitesKilled, l.xpEarned, l.baseCaps, l.baseDefs, l.factionID, l.shotsFired, l.shotsHit, l.loginTimestamp, l.logoutTimestamp, 0 FROM latestGameSessions l WHERE l.character_id IN (${'?,'.repeat(mainStatsCharIDs.length).slice(0, -1)}) ON DUPLICATE KEY UPDATE kills = totalGameSessions.kills + l.kills, killsHS = totalGameSessions.killsHS + l.killsHS, killsIvI = totalGameSessions.killsIvI + l.killsIvI, killsHSIvI = totalGameSessions.killsHSIvI + l.killsHSIvI, deaths = totalGameSessions.deaths + l.deaths, deathsIvI = totalGameSessions.deathsIvI + l.deathsIvI, vehicleKills = totalGameSessions.vehicleKills + l.vehicleKills, vehicleDeaths = totalGameSessions.vehicleDeaths + l.vehicleDeaths, vehicleBails = totalGameSessions.vehicleBails + l.vehicleBails, nanitesLost = totalGameSessions.nanitesLost + l.nanitesLost, nanitesKilled = totalGameSessions.nanitesKilled + l.nanitesKilled, xpEarned = totalGameSessions.xpEarned + l.xpEarned, baseCaps = totalGameSessions.baseCaps + l.baseCaps, baseDefs = totalGameSessions.baseDefs + l.baseDefs, shotsFired = CASE WHEN l.archived = 1 THEN totalGameSessions.shotsFired + l.shotsFired ELSE totalGameSessions.shotsFired END, shotsHit = CASE WHEN l.archived = 1 THEN totalGameSessions.shotsHit + l.shotsHit ELSE totalGameSessions.shotsHit END, logoutTimestamp = l.logoutTimestamp;`, mainStatsCharIDs)
		.catch(e => console.log(`ERROR SAVING TO totalGameSessions (new entries): ${e}`));

	client.db.query(`INSERT INTO latestGameSessions ${mainStatsParams} VALUES ${'(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),'.repeat(mainStatsCharIDs.length).slice(0, -1)} ON DUPLICATE KEY UPDATE kills = VALUES(kills), killsHS = VALUES(killsHS), killsIvI = VALUES(killsIvI), killsHSIvI = VALUES(killsHSIvI), deaths = VALUES(deaths), deathsIvI = VALUES(deathsIvI), vehicleKills = VALUES(vehicleKills), vehicleDeaths = VALUES(vehicleDeaths), vehicleBails = VALUES(vehicleBails), nanitesLost = VALUES(nanitesLost), nanitesKilled = VALUES(nanitesKilled), xpEarned = VALUES(xpEarned), baseCaps = VALUES(baseCaps), baseDefs = VALUES(baseDefs), factionID = VALUES(factionID), shotsFired = VALUES(shotsFired), shotsHit = VALUES(shotsHit), loginTimestamp = VALUES(loginTimestamp), logoutTimestamp = VALUES(logoutTimestamp), archived = 0;`, mainStats)
		.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS: ${e}`));
	
	if (vehiclesKilledStats.length > 0) {
		await client.db.query(`DELETE FROM latestGameSessions_vehiclesKilled WHERE character_id IN (${'?,'.repeat(mainStatsCharIDs.length).slice(0, -1)})`, mainStatsCharIDs)
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS vehiclesKilled: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_vehiclesKilled (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(vehiclesKilledStats.length / 3).slice(0, -1)};`, vehiclesKilledStats)
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS vehiclesKilled: ${e}`));
	}
	if (vehiclesLostStats.length > 0) {
		await client.db.query(`DELETE FROM latestGameSessions_vehiclesLost WHERE character_id IN (${'?,'.repeat(mainStatsCharIDs.length).slice(0, -1)})`, mainStatsCharIDs)
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS vehiclesLost: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_vehiclesLost (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(vehiclesLostStats.length / 3).slice(0, -1)};`, vehiclesLostStats)
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS vehiclesLost: ${e}`));
	}
	if (xpTypesStats.length > 0) {
		await client.db.query(`DELETE FROM latestGameSessions_xpTypes WHERE character_id IN (${'?,'.repeat(mainStatsCharIDs.length).slice(0, -1)})`, mainStatsCharIDs)
			.catch(e => console.log(`ERROR DELETING CLOSED SESSIONS xpTypes: ${e}`));
		client.db.query(`INSERT INTO latestGameSessions_xpTypes (character_id, experience_id, amount, timestamp) VALUES ${'(?, ?, ?, ?),'.repeat(xpTypesStats.length / 4).slice(0, -1)};`, xpTypesStats)
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS xpTypes: ${e}`));
	}
	return true;
}

const saveSessionCache = async (client) => {
	if (!client.socketManager) return logger.logDev('No socket manager, cancelling cache save.');

	const sessions = client.socketManager.activeSessions;
	if (sessions.size === 0) return logger.logDev('activeSession empty, cancelling cache save.');
	
	let mainStats = [];
	let vehiclesKilledStats = [];
	let vehiclesLostStats = [];
	let xpTypesStats = [];

	for (const [character_id, session] of sessions) {
		mainStats.push(character_id, session.name, session.kills, session.killsHS, session.killsIvI, session.killsHSIvI, session.deaths, session.deathsIvI, session.vehicleKills, session.vehicleDeaths, session.vehicleBails, session.nanitesLost, session.nanitesKilled, session.xpEarned, session.baseCaps, session.baseDefs, session.factionID, session.shotsFired, session.shotsHit, session.loginTimestamp, session.worldID, 0)
		vehiclesKilledStats = vehiclesKilledStats.concat(session.vehiclesKilled.map(vehicle => [character_id, vehicle.name, vehicle.amount]).flat());
		vehiclesLostStats = vehiclesLostStats.concat(session.vehiclesLost.map(vehicle => [character_id, vehicle.name, vehicle.amount]).flat());
		xpTypesStats = xpTypesStats.concat(session.xpTypes.map(type => [character_id, type.experience_id, type.amount]).flat());
	}
	const mainStatsParams = '(character_id, name, kills, killsHS, killsIvI, killsHSIvI, deaths, deathsIvI, vehicleKills, vehicleDeaths, vehicleBails, nanitesLost, nanitesKilled, xpEarned, baseCaps, baseDefs, factionID, shotsFired, shotsHit, loginTimestamp, worldID, archived)';
	
	if (mainStats.length > 0) {
		await client.db.query('DELETE FROM sessionCache;')
			.catch(e => console.log(`ERROR DELETING FROM sessionCache: ${e}`))
		for (let i = 0; i < mainStats.length / 42592; i++) { // 42592 for almost 2k sessions
			let mainStatsToInsert = mainStats.slice(42592 * i, 42592 * (i + 1));
			await client.db.query(`INSERT INTO sessionCache ${mainStatsParams} VALUES ${'(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),'.repeat(mainStatsToInsert.length / 22).slice(0, -1)};`, mainStatsToInsert.map(s => s === undefined ? null : s))
				.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS: ${e}`));
		}
		await client.db.query(`INSERT INTO sessionCache (character_id, name, loginTimestamp, worldID) VALUES ("1", "Saved At", ?, 0) ON DUPLICATE KEY UPDATE loginTimestamp = VALUES(loginTimestamp);`, [Date.now()])
			.catch(e => console.log(`ERROR SAVING CLOSED SESSIONS: ${e}`));
	}
	if (vehiclesKilledStats.length > 0) {
		await client.db.query('DELETE FROM sessionCache_vehiclesKilled;')
			.catch(e => console.log(`ERROR DELETING FROM sessionCache_vehiclesKilled: ${e}`));
		for (let i = 0; i < vehiclesKilledStats.length / 42591; i++) {
			let mainStatsToInsert = vehiclesKilledStats.slice(42591 * i, 42591 * (i + 1));
			await client.db.query(`INSERT INTO sessionCache_vehiclesKilled (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(mainStatsToInsert.length / 3).slice(0, -1)};`, mainStatsToInsert.map(s => s === undefined ? null : s))
				.catch(e => console.log(`ERROR SAVING FROM sessionCache_ehiclesKilled: ${e}`));
		}
	}
	if (vehiclesLostStats.length > 0) {
		await client.db.query('DELETE FROM sessionCache_vehiclesLost;')
			.catch(e => console.log(`ERROR DELETING FROM sessionCache_vehiclesLost: ${e}`));
		for (let i = 0; i < vehiclesLostStats.length / 42591; i++) {
			let mainStatsToInsert = vehiclesLostStats.slice(42591 * i, 42591 * (i + 1));
			await client.db.query(`INSERT INTO sessionCache_vehiclesLost (character_id, name, amount) VALUES ${'(?, ?, ?),'.repeat(mainStatsToInsert.length / 3).slice(0, -1)};`, mainStatsToInsert.map(s => s === undefined ? null : s))
				.catch(e => console.log(`ERROR SAVING FROM sessionCache_vehiclesLost: ${e}`));
		}
	}
	if (xpTypesStats.length > 0)	{
		await client.db.query('DELETE FROM sessionCache_xpTypes;')
			.catch(e => console.log(`ERROR DELETING FROM sessionCache_xpTypes: ${e}`));
		for (let i = 0; i < xpTypesStats.length / 42591; i++) {
			let mainStatsToInsert = xpTypesStats.slice(42591 * i, 42591 * (i + 1));
			await client.db.query(`INSERT INTO sessionCache_xpTypes (character_id, experience_id, amount) VALUES ${'(?, ?, ?),'.repeat(mainStatsToInsert.length / 3).slice(0, -1)};`, mainStatsToInsert.map(s => s === undefined ? null : s))
				.catch(e => console.log(`ERROR SAVING FROM sessionCache_xpTypes: ${e}`));
		}
	}
	console.log(`Saved ${sessions.size} sessions!`)
	return true;
}

const loadSessionCache = async (client) => {
	if (!client.socketManager) return logger.logDev('No socket manager, cancelling cache load.');
	if (client.worldPops.length === 0) return logger.logDev('World population not initialized, cancelling cache load.');
	if (process.argv.includes('--new-sessions')) return logger.logDev('--new-sessions passed, starting afresh.')

	const lastSave = await client.db.query('SELECT loginTimestamp FROM sessionCache WHERE character_id = "1";');
	if (lastSave.length === 0) return logger.logDev(`Couldn't get last save timestamp for session caches, starting afresh.`)
	if (lastSave[0].loginTimestamp < Date.now() - 300000) return logger.logDev('Session Cache too old, starting afresh.');

	console.log('Loading sessions to cache...');

	const sessionRows = await client.db.query('SELECT * FROM sessionCache;').catch(e => console.log(e));

	if (sessionRows.length < 2) return console.log('No sessions found.');
	
	for (const row of sessionRows.filter(e => e.character_id != 1)) { // filters out timekeeping row

		const vehiclesKilledRows = await client.db.query('SELECT * FROM sessionCache_vehiclesKilled;').catch(e => console.log(e));
		const vehiclesLostRows = await client.db.query('SELECT * FROM sessionCache_vehiclesLost;').catch(e => console.log(e));
		const xpTypesRows = await client.db.query('SELECT * FROM sessionCache_xpTypes;').catch(e => console.log(e));

		client.worldPops[row.worldID][row.factionID]++;
		client.socketManager.activeSessions.set(row.character_id, {
			character_id: row.character_id,
			name: row.name,
			kills: row.kills,
			killsHS: row.killsHS,
			killsIvI: row.killsIvI,
			killsHSIvI: row.killsHSIvI,
			deaths: row.deaths,
			deathsIvI: row.deathsIvI,
			vehicleKills: row.vehicleKills,
			vehicleDeaths: row.vehicleDeaths,
			vehicleBails: row.vehicleBails,
			nanitesLost: row.nanitesLost,
			nanitesKilled: row.nanitesKilled,
			vehiclesKilled: vehiclesKilledRows.filter(r => r.character_id == row.character_id).map(r => { return { name: r.name, amount: r.amount } }),
			vehiclesLost: vehiclesLostRows.filter(r => r.character_id == row.character_id).map(r => { return { name: r.name, amount: r.amount } }),
			xpTypes: xpTypesRows.filter(r => r.character_id == row.character_id).map(r => { return { experience_id: r.experience_id, amount: r.amount } }),
			xpEarned: row.xpEarned,
			baseCaps: row.baseCaps,
			baseDefs: row.baseDefs,
			factionID: row.factionID,
			latestDeath: row.latestDeath,
			latestVehicleLost: row.latestVehicleLost,
			shotsFired: row.shotsFired,
			shotsHit: row.shotsHit,
			loginTimestamp: row.loginTimestamp,
			logoutTimestamp: null,
			worldID: row.worldID
		});
	}
	console.log(`Successfully reloaded ${sessionRows.length} sessions.`);
	return true;
}

module.exports = {
	getNewSessions,
	archiveSessions,
	saveSession,
	saveSessions,
	saveSessionCache,
	loadSessionCache
}