const commando = require('discord.js-commando');
const fs = require('fs');
const { saveSessionCache, loadSessionCache } = require(__dirname + '/ps2_functions/sessionFunctions.js');

require('dotenv').config();

const cleanup = require('node-cleanup');

// Persist active sessions to reload when the app restarts.
cleanup((function (exitCode, signal) {
	if (signal) {
		console.log('Copying cache to DB...');
		if (!client.db) return console.log('cilent.db is undefined.');

		saveSessionCache(client).then((t) => {
			console.log('Finished. Exiting.');
			process.kill(process.pid, signal);
		}).catch(e => logger.logError('Error saving session cache:', e));

		cleanup.uninstall();
		return false;
	}
	logger.logEvent(`No signal received - Cannot execute async operation (Exit code ${exitCode})`);
}));

const DeployManager = require('./managers/DeployManager.js');
const DiscordManager = require('./managers/DiscordManager.js');
const SocketManager = require('./managers/SocketManager.js');
const DatabaseManager = require('./managers/DatabaseManager.js');
const logger = require('./utils/logutils.js');

const ps2 = require('./ps2_functions/utils.js');

const client = new commando.Client({
	owner: '254728052070678529',
	commandPrefix: '!',
    unknownCommandResponse: false,
    disableEveryone: true
});

/** STATIC CONTAINERS **/
// From JSON
client.weaponNames = [];
client.IVIWeaponIDs = [];
client.vehicleTypes = [];
client.experienceTypes = [];

client.queryStart = `https://census.daybreakgames.com/s:${process.env.censusSID}/get/ps2/`;
client.socketLink = `wss://push.planetside2.com/streaming?environment=ps2&service-id=s:${process.env.censusSID}`;

client.factionMap = ["No Faction", "Vanu Sovereignty", "New Conglomerate", "Terran Republic", "Nanite Systems"];
client.colorMap = ["#575757", "#b035f2", "#2a94f7", "#e52d2d", "#e5e5e5"];
client.imageMap = ["https://i.imgur.com/9nHbnUh.jpg", "https://bit.ly/2RCsHXs", "https://bit.ly/2AOZJJB", "https://bit.ly/2Mm6wij", "https://i.imgur.com/9nHbnUh.jpg"];

client.worldMap = {
    1: "Connery",
    10: "Miller",
    13: "Cobalt",
    17: "Emerald",
    19: "Jaeger",
    // 25: "Briggs",
	40: "Soltech",
	60: "Koltyr",
	61: "Desolation"
}
client.zoneMap = {
    2: "Indar",
    4: "Hossin",
    6: "Amerish",
    8: "Esamir",
    // 96: "VRTrainingNC",
    // 97: "VRTrainingTR",
    // 98: "VRTrainingVS",
    // 200: "Cleanroom"
}
client.emoji_to_WorldID_Map = {
    '1⃣': 1,
    '2⃣': 10,
    '3⃣': 13,
    '4⃣': 17,
    '5⃣': 40,
}

client.eventInfo = {}

client.timezoneMap = {
	'Pacific/Honolulu': 'Hawaii Standard Time',
	'America/Los_Angeles': 'Pacific Time',
	'America/New_York': 'Eastern Time',
	'America/Fortaleza': 'Brasília Time',
	'GMT': 'Greenwich Mean Time',
	'Europe/Madrid': 'Central European Time',
	'Europe/Bucharest': 'Eastern European Time',
	'Asia/Shanghai': 'China Standard Time',
	'Australia/Eucla': 'Australian Central Western Standard Time',
	'Pacific/Auckland': 'New Zealand Time' 
}
client.reactionMap = [
    '1⃣',
    '2⃣',
    '3⃣',
    '4⃣',
    '5⃣',
    '6⃣',
    '7⃣',
    '8⃣',
    '9⃣',
    '🔟'
]

client.eventSubscriptions = [
	"PlayerLogin",
	"PlayerLogout",
	"GainExperience",
	"Death",
	"VehicleDestroy",
	"PlayerFacilityCapture",
	"PlayerFacilityDefend",
	"BattleRankUp",
	"MetagameEvent",
	"ContinentLock",
	"ContinentUnlock"
]

/** DYNAMIC CONTAINERS **/
// Updates to apply to the statusMessage, caused by an admin config, updates from the socket, or a reboot. Mapped by guild ID.
client.updates = {};
// Channel, statusMessage, and promptMessage IDs to refer to when the bot restarts. Mapped by guild ID. SS = Server Status
client.guildSSData = {};
// Which worlds are being tracked in each guild. Mapped by guild ID.
client.guildWorldData = {};
// Which worlds we're receiving events for, and their events. Mapped by world ID (world_id, event_name)
client.subscriptions = {};
// An object mapped by world IDs, whose value is a Collection<zoneID, latestEvent>
client.worldZones = {};
// An object mapped by world IDs, whose value is the name of the next zone to unlock.
// { [ world_id: {Map(zone_id => { timestamp: val })}, ... ] }
client.upcomingZones = {};
// Zone lock history with timestamps
client.zoneHistory = {};

// Each world's character population, mapped by faction ID.
client.worldPops = {};

// Client start time.
client.startedTimestamp = null;

// Cached DB Rows
client.timezones = new Map();
client.eventSubs = [];
client.publicRoles = [];

client.start = async () => {

	// Get static data.
	client.weaponNames = JSON.parse(fs.readFileSync(__dirname + '/static_data/weaponNames.json'));
	client.IVIWeaponIDs = JSON.parse(fs.readFileSync(__dirname + '/static_data/IVIWeaponIDs.json'));
	client.vehicleTypes = JSON.parse(fs.readFileSync(__dirname + '/static_data/vehicleTypes.json'));
	client.experienceTypes = JSON.parse(fs.readFileSync(__dirname + '/static_data/experienceTypes.json'));
	client.eventInfo = JSON.parse(fs.readFileSync(__dirname + '/static_data/eventInfo.json'));

	// Initialize managers.
	client.db = new DatabaseManager();
	client.socketManager = new SocketManager(client.eventSubscriptions);
	client.deployManager = new DeployManager(client);

	await client.db.init();
	client.socketManager.init(client, client.socketLink);

	// Initialize world info.
	for (const world_id in client.worldMap) {
		client.worldPops[world_id] = [null, 0, 0, 0, 0];
		client.zoneHistory[world_id] = new Map();
	}

	// Load in recent session data.
	client.sessionsReloaded = await loadSessionCache(client);

	// Load guild data
	ps2.updateGuildData(client);

	await client.updateTableCaches('timezones', 'eventSubs', 'publicRoles');

	// Start the client
	let discordManager = new DiscordManager();
	discordManager.init(client);

	runFilesAt(__dirname + '/timers', true);
}

client.uptime = () => Date.now() - client.startedTimestamp;

/**
 * @description Executes the run() function in all .js files under `directory`.
 * @param {string} directory Path to the file.
 * @param {boolean} runOnInterval run() on an interval of `time` milliseconds. Where `time` is a variable in the file's exports.
 * @returns {void}
 */
const runFilesAt = async (directory, runOnInterval = false) => {

	fs.readdir(directory, async (e, files) => {
		if (e) return console.log(e);
		if (!files) return console.error('No files in directory.');

		files.forEach(f => {
			if (!f.endsWith('.js')) return;
			let exported = require(`${directory}/${f}`);

			if (runOnInterval) client.setInterval(exported.run, exported.time, client);
			else exported.run(client);
		});
		console.log(`Starting ${runOnInterval ? 'timers' : 'functions'} \x1b[36m${files.join(', ')}\x1b[0m`);
	});
}

client.updateTableCaches = async (...tableNames) => {
	for (const table of tableNames) {
		const foundTables = await client.db.query(`SHOW TABLES LIKE "${table}";`);
		if (foundTables.length == 0) continue;

		client[table] = await client.db[`fetch_${table}`]();
	}
}

process.on('unhandledRejection', (reason, promise) => {
	logger.logError(`Unhandled Promise Rejection! - Reason: ${reason}`, promise);
});

process.on('uncaughtException', (e) => logger.logError('Uncaught Exception thrown.', e));

client.start();
