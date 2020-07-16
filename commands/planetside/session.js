const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

const { getTimeUntil } = require('../../utils/timeutils.js');
const { checkDenom } = require('../../ps2_functions/misc.js');
const { newStatDescription } = require('../../ps2_functions/utils.js');
const { logEvent } = require('../../utils/logutils.js');

module.exports = class SessionCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'session',
            aliases: ['se'],
            group: 'planetside',
            memberName: 'session',
            description: 'View a character\'s most recent play session.\nDefinitions: KDR = Kill/Death Ratio, KPM = Kills Per Minute, VKDR = Vehicle KDR, IvI = Infantry vs. Infantry, HSR = Headshot Ratio, ACC = Accuracy, IvI Score = HSR * ACC\n__Usage:__ !session <character name>',
            throttling: {
                usages: 5,
                duration: 60
            },
            argsPromptLimit: 0,
            args: [
                {
                    key: 'charName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
	}
    
	async run (message, { charName }) {
		
		if (!charName) return message.say('Please provide a character name.');

		// Get latest session from DB.
		const rows = await this.client.db.query(`SELECT * FROM latestGameSessions WHERE name LIKE ? ORDER BY (name = ?) DESC, length(name);`, [charName + '%', charName]);
		if (rows.length == 0) return message.say(`Couldn't find a session under the name '${charName}'`);

		let character_id = rows[0].character_id;
		let characterName = rows[0].name;

		// Get additional session info from DB.
		const rows_xpTypes = await this.client.db.query(`SELECT * FROM latestGameSessions_xpTypes WHERE character_id = ? ORDER BY amount DESC LIMIT 20;`, [character_id]);
		const rows_vehiclesKilled = await this.client.db.query(`SELECT * FROM latestGameSessions_vehiclesKilled WHERE character_id = ?;`, [character_id]);
		const rows_vehiclesLost = await this.client.db.query(`SELECT * FROM latestGameSessions_vehiclesLost WHERE character_id = ?;`, [character_id]);

		// There should only ever be one result, but just in case log
		if (rows.length > 1) logEvent(`!session - rows.length > 1 for ${characterName} in table latestGameSessions!`);
		
		// Put additional data on the session.
		let session = rows[0];
		session.vehiclesKilled = rows_vehiclesKilled.map(v => { return { name: v.name, amount: v.amount } });
		session.vehiclesLost = rows_vehiclesLost.map(v => { return { name: v.name, amount: v.amount } });
		session.xpTypes = rows_xpTypes;

		let playTimeSeconds = session.logoutTimestamp - session.loginTimestamp;
		let factionID = session.factionID;

		// IvI
		let hsr = (100 * (session.killsHSIvI / checkDenom(session.killsIvI))).toFixed(2);
		let acc = (100 * (session.shotsHit / checkDenom(session.shotsFired))).toFixed(2);

		// Vehicles
		let vehiclesKilled = session.vehiclesKilled.length == 0 ? 'None' : session.vehiclesKilled.map(v => `${v.amount}x ${v.name}`).join(', ');
		let vehiclesLost = session.vehiclesLost.length == 0 ? 'None' : session.vehiclesLost.map(v => `${v.amount}x ${v.name}`).join(', ');

		// Have to sort here instead of in the query because I want it by the order of xp*amount rather than just amount (which is all the db has access to)
		// This could be fixed by storing experienceTypes.json in its own table and referencing it like so (amount * experienceTypes.xp).
		let xpSources = session.xpTypes.sort((a, b) => {
			let a_xpType = this.client.experienceTypes.find(t => t.experience_id === a.experience_id);
			let b_xpType = this.client.experienceTypes.find(t => t.experience_id === b.experience_id);

			if (!a_xpType || !b_xpType) return -1;

			let a_xp = a_xpType.xp;
			let b_xp = b_xpType.xp
			
			return b_xp * b.amount - a_xp * a.amount;
		});
		console.log('made xp calculations')
		xpSources = xpSources.slice(0, 9);
		xpSources = xpSources.map(r => {
			let xpType = this.client.experienceTypes.find(t => t.experience_id === r.experience_id);
			if (!xpType) return;
			return `${xpType.xp * r.amount}xp | ${r.amount}x | ${xpType.description}`;
		}).filter(r => r != undefined).join('\n');

		let timezone = this.client.timezones.has(message.author.id) ? this.client.timezones.get(message.author.id).timezone : 'GMT';

		let embed = new RichEmbed()
			.setTitle(characterName)
			.addField(`General Stats`, newStatDescription({
				playerKills: session.kills,
				playerDeaths: session.deaths,
				KDR: (session.kills / checkDenom(session.deaths)).toFixed(2),
				KPM: ((session.kills / checkDenom(playTimeSeconds)) * 60).toFixed(2),
				vehicleKills: session.vehicleKills,
				vehicleDeaths: session.vehicleDeaths,
				VKDR: (session.vehicleKills / checkDenom(session.vehicleDeaths)).toFixed(2),
				vehicleBails: session.vehicleBails,
				vehiclesKilled,
				vehiclesLost,
				[`nanitesKilled/Spent`]: `${session.nanitesKilled}/${session.nanitesLost}`,
				playTime: getTimeUntil(playTimeSeconds * 1000),
				logoutTime: `${new Date(session.logoutTimestamp * 1000).toLocaleDateString("en-US", { timeZone: timezone })} ${new Date(session.logoutTimestamp * 1000).toLocaleTimeString("en-US", {timeZone: timezone})}`
			}, [4, 11]), true)
			.addField(`Infantry vs. Infantry`, newStatDescription({
				HSR: hsr + '%',
				Acc: session.archived == 1 ? acc + '%' : `Pending API update...`,
				score: session.archived == 1 ? (hsr * acc).toFixed(2) : `Pending API update...`,
				kills: session.killsIvI,
				deaths: session.deathsIvI,
				KDR: (session.killsIvI / checkDenom(session.deathsIvI)).toFixed(2),
				KPM: ((session.killsIvI / checkDenom(playTimeSeconds)) * 60).toFixed(2),
				SPK: session.archived == 1 ? (session.shotsFired / checkDenom(session.killsIvI)).toFixed(2) : `Pending API update...`,
				HPK: session.archived == 1 ? (session.shotsHit / checkDenom(session.killsIvI)).toFixed(2) : `Pending API update...`
			}, [3, 7]), true)
			.addField(`XP Stats`, 
				`**XP Earned -** ${session.xpEarned}\n**Top 8 XP sources**:\n**Total XP | Amount | XP type**\n${xpSources}`)
            .setColor(this.client.colorMap[factionID])
            .setFooter(character_id, this.client.imageMap[factionID])
        message.embed(embed);
    }
}
