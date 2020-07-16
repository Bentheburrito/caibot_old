const WebSocket = require('ws');
const fs = require('fs');

const sessionFns = require('../ps2_functions/sessionFunctions.js');
const ps2 = require('../ps2_functions/utils.js');
const { delay } = require('../utils/timeutils.js');
const logger = require('../utils/logutils.js');

class SocketManager {

	constructor(events, charsAndWorld = false) {
		this.sessionsToSave = [];
		this.activeSessions = new Map();
		this.pendingSessions = []; // Holds the character_info to be passed to sessionFns.getNewSessions() with the interval
		this.queue = {}; // Holds the payloads for sessions that have yet to be processed. queue { character_id: [payload1, payload2, ...], ...}

		this.events = events ? events : ["all"];
		this.charsAndWorld = charsAndWorld;
	}

	async init (client, link) {
		
		if (this.censusSocket && (this.censusSocket.readyState === WebSocket.OPEN || this.censusSocket.readyState === WebSocket.CONNECTING))
			return console.log('Did not attempt to open websocket.\nReason: socket is already open/connecting.');

		this.censusSocket = new WebSocket(link);
		
		await this.registerListeners(client);

		return true;
	}

	async registerListeners (client) {

		this.censusSocket.on('message', async (json) => {
			var data = JSON.parse(json);

			if (data.online || (data.connected && data.connected === 'true') || data['send this for help']) return;
			if (data.subscription) return console.log(data.subscription.eventNames.length < 1 ? `Cleared Subscriptions` : `Subscribed to events:\n\x1b[36m${data.subscription.eventNames.join(', ')}\x1b[0m\non worlds \x1b[36m${data.subscription.worlds.join(', ')}\x1b[0m with ${data.subscription.characterCount} chars`)

			// temp logs, praying for ContinentUnlock events to be fixed some day.
			if (['201', '200', '199', '198'].some(i => i == data.payload.metagame_event_id)) logger.logDev(`EVENT ID ${data.payload.metagame_event_id} ON WORLD ${data.payload.world_id}, ZONE ID ${data.payload.zone_id}`);
			if (data.payload.event_name == 'ContinentLock' || data.payload.event_name == 'ContinentUnlock') logger.logDev(`${data.payload.event_name} ON WORLD ${data.payload.world_id} ZONE ID ${data.payload.zone_id}`);

			if (!data.payload) return;
			this.handlePayload(client, data.payload);
		});

		this.censusSocket.on('open', () => {
			console.log('Connected to the Web Socket.');
			this.subscribe(client);
			
		});

		this.censusSocket.on('close', e => {
			logger.logError(`${this.name} - Socket Closed - ${e}`)

			console.log('Socket closed, reconnecting...');
			this.init(client, client.socketLink);
		});

		this.censusSocket.on('error', (e) => {
			console.log('PS2 CENSUS WEBSOCKET ERROR:')
			console.log(e);
		});
	}

	async handlePayload (client, payload) {

		if (payload.character_id == 0) return;
		let session = this.activeSessions.get(payload.character_id);
		const timestamp = parseInt(payload.timestamp);

		if (payload.event_name === 'PlayerLogin') {
			if (session && Date.now() / 1000 - session.latestAction < 900) return;

			if (!this.pendingSessions.some(c_info => c_info.includes(payload.character_id))) this.pendingSessions.push([payload.character_id, timestamp, payload.world_id]);
			this.queue[payload.character_id] = [];
			return;

		} else if (payload.event_name === 'PlayerLogout') {
			if (!session) return;

			session.logoutTimestamp = timestamp;

			this.sessionsToSave.push(session);
			this.activeSessions.delete(payload.character_id);

			// temp
			if (process.argv.includes('logs')) {
				console.log(payload.character_id)
				console.log(session)
			}
			if (client.worldPops[payload.world_id][session.factionID] > 0) client.worldPops[payload.world_id][session.factionID]--;
			return;
		}

		if (!session && payload.character_id && !payload.attacker_character_id) return //console.log(handlePayload - `No session record for ${payload.character_id} but received player event.`);
		// If this char is still awaiting the next iteration of getNewSessions interval, queue this payload for later.
		if (payload.character_id in this.queue && !this.activeSessions.has(payload.character_id)) return this.queue[payload.character_id].push(payload);

		if (payload.event_name === 'GainExperience') {

			session.xpEarned += parseInt(payload.amount);
			let type = session.xpTypes.find(entry => entry.experience_id == payload.experience_id);
			type ? type.amount++ : session.xpTypes.push({ experience_id: payload.experience_id, amount: 1 });

			session.latestAction = timestamp;
		} else if (payload.event_name === 'Death') {
			
			let isInfantryWeapon = client.IVIWeaponIDs.includes(payload.attacker_weapon_id);
			const isIvIKill = isInfantryWeapon && (payload.attacker_vehicle_id == 0 || payload.attacker_vehicle_id == 1012);

			// Owner
			if (session && payload.timestamp - session.latestDeath > 8) { // This needs testing
				session.deaths++;
				session.latestDeath = timestamp;
				session.latestAction = timestamp;

				if (isIvIKill) session.deathsIvI++;
			}
			
			// Attacker
			let session_a = this.activeSessions.get(payload.attacker_character_id);
			if (!session_a) return //console.log(`Death - No session record for attacker ${payload.attacker_character_id}.`);

			if (isIvIKill) {
				session_a.killsIvI++;
				if (payload.is_headshot > 0) session_a.killsHSIvI++;
			}

			session_a.kills++;
			if (payload.is_headshot > 0) session_a.killsHS++;
			
			session_a.latestAction = timestamp;
		} else if (payload.event_name === 'VehicleDestroy') {

			let vehicleInfo = client.vehicleTypes.find(v => v.vehicle_id == payload.vehicle_id);
			if (!vehicleInfo) return console.log('vehicle id: ' + payload.vehicle_id)

			let vehicle;

			// Owner
			if (session) {
				vehicle = session.vehiclesLost.find(v => v.name == vehicleInfo.name);

				if (!vehicle) {
					vehicle = { name: vehicleInfo.name, amount: 1};
					session.vehiclesLost.push(vehicle);
				} else
					vehicle.amount++;

				session.nanitesLost += parseInt(vehicleInfo.cost);
				session.vehicleDeaths++;
				session.latestVehicleLost = timestamp;
				session.latestAction = timestamp;

				delay(13000).then(() => { if ((Date.now() / 1000) - session.latestDeath > 15) session.vehicleBails++; });
			}

			if (payload.character_id == payload.attacker_character_id) return;

			// Attacker
			let session_a = this.activeSessions.get(payload.attacker_character_id);
			if (!session_a) return //console.log(`${payload.attacker_character_id} (vehicle destroy attacker) has no session).`);
			
			vehicle = session_a.vehiclesKilled.find(v => v.name == vehicleInfo.name);

			if (!vehicle) {
				vehicle = { name: vehicleInfo.name, amount: 1 };
				session_a.vehiclesKilled.push(vehicle);
			} else vehicle.amount++;

			session_a.nanitesKilled += parseInt(vehicleInfo.cost);
			session_a.vehicleKills++;
			session_a.latestAction = timestamp;

		} else if (payload.event_name === 'PlayerFacilityCapture') {

			session.baseCaps++;
			session.latestAction = timestamp;

		} else if (payload.event_name === 'PlayerFacilityDefend') {

			session.baseDefs++;
			session.latestAction = timestamp;

		} else if (payload.event_name === 'BattleRankUp') {

			// if (!session.battleRanksEarned.includes(parseInt(payload.battle_rank)))
			// 	session.battleRanksEarned.push(parseInt(payload.battle_rank));
			const br = parseInt(payload.battle_rank);
			session.latestAction = timestamp;
			client.db.query(`INSERT INTO battleRanksEarned VALUES (?, ?, ?);`, [session.character_id, br, payload.timestamp]);
			
		} else if (payload.event_name === 'MetagameEvent') {

			let texts = client.eventInfo.find(e => e.id == payload.metagame_event_id);
			if (!texts) return logger.logEvent(`INVALID metagame_event_id! : ${payload.metagame_event_id}`)

			if (texts.zone_id) {
				client.worldZones[payload.world_id].set(texts.zone_id, {
					state: payload.metagame_event_state,
					instance_id: payload.instance_id,
					name: texts.name,
					description: texts.description,
					timestamp: payload.timestamp,
					event_id: parseInt(payload.metagame_event_id)
				});
			}

			if (payload.metagame_event_state == '135')
				ps2.notifyEventSubscribers(client, texts.name, payload.metagame_event_id, parseInt(payload.world_id), payload.timestamp * 1000)
					.catch(e => console.log(`notifyEventSubscribers Rejected: ${e}`));

			for (var guildID in client.guildWorldData) {

				if (!client.guildWorldData[guildID].worlds.includes(parseInt(payload.world_id))) {
					console.log('Does not include world_id ' + payload.world_id);
					continue;
				}
				let promptMsg;
				try { promptMsg = await ps2.getPromptMessage(client, guildID) }
				catch (e) { console.log(`Try Catch: getPromptMessage failed: ${e}`); continue; }
				var ids = await ps2.getTrackedIDs(promptMsg, client.emoji_to_WorldID_Map);

				client.updates[guildID] = { worldIDs: ids }
			}
		} else if (payload.event_name === 'ContinentUnlock') {
			let zoneID = payload.zone_id;

			ps2.notifyEventSubscribers(client, client.zoneMap[zoneID], undefined, parseInt(payload.world_id), payload.timestamp * 1000)
				.catch(e => console.log(`notifyZoneSubscribers Rejected: ${e}`));

			if (!client.worldZones[payload.world_id].has(zoneID) && client.zoneMap[zoneID])
				client.worldZones[payload.world_id].set(zoneID, { state: undefined, instance_id: undefined, name: undefined, description: undefined, timestamp: undefined, event_id: undefined });

		} else if (payload.event_name === 'ContinentLock') {

			// client.worldZones[payload.world_id].delete(payload.zone_id);
			await ps2.updateWorldZones(client, [payload.world_id]);
			ps2.rotateZones(client, payload);
		}
	}

	async subscribe (client) {
		
		let characters = ["all"];
		let worlds = ["all"];

		if (process.argv.includes('filter')) {
			const rows = await client.db.query('SELECT * FROM trackedUsers;');
			characters = rows.map(r => r.id);
			if (!this.events.includes('MetagameEvent')) worlds = [];
		}
		this.censusSocket.send(JSON.stringify({
			"service": "event",
			"action": "subscribe",
			"characters": characters,
			"worlds": worlds,
			// "logicalAndCharactersWithWorlds": this.charsAndWorld,
			"eventNames": this.events
		}));
	}
}

module.exports = SocketManager;