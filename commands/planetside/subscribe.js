const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

const TimezoneCommand = require('./../public/timezone.js')
const utils = require('../../ps2_functions/utils');

module.exports = class SubscribeCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'subscribe',
			aliases: ['sub', 'subscriptions'],
			group: 'planetside',
			memberName: 'subscribe',
			description: 'Have the bot DM you when `eventName` starts on the servers `serverName`s. Note: If `eventName` is more than one word, wrap it in quotes (example below.)\n__Usage:__ !subscribe "<eventName>" <serverName1> <serverNameX> ...\n\n__Examples:__\n**!sub "aerial anomalies" connery miller** - subscribe to Aerial Anomalies events on Connery and Miller\n**!sub "refine and refuel"** - subscribe to Refine and Refuel events on __all servers__\n**!sub** - view all your event subscriptions.\n\nUse !events for a list of accepted events.',
			throttling: {
				usages: 8,
				duration: 60
			},
			argsPromptLimit: 0,
			args: [
				{
					key: 'eventName',
					prompt: '',
					type: 'string',
					default: '',
					validate: () => true
				},
				{
					key: 'worldNames',
					prompt: '',
					type: 'string',
					default: '',
					validate: () => true
				}
			]
		});
	}

	async run (message, { eventName, worldNames }) {

		// Send list of subscriptions if no eventName.
		const currentSubscriptions = this.client.eventSubs.filter(r => r.subscriber_id === message.author.id);
		if (!eventName) {
			let embed = new RichEmbed()
				.setTitle('Event subscriptions')
				.setDescription('')
				.setColor(this.client.colorMap[Math.floor(Math.random() * this.client.colorMap.length)]);

			for (var sub of currentSubscriptions) {
				const event_info = this.client.eventInfo.find(event => sub.event_name === event.name);
				if (!event_info) continue;
				embed.description += embed.description.includes(event_info.name) ? '' : `**${event_info.name}**\nOn servers: ${currentSubscriptions.filter(s => s.event_name == event_info.name).map((s, i, arr) => `__${this.client.worldMap[s.world_id]}__${i + 1 <= arr.length - 1 && arr[i + 1].minTime === s.minTime && arr[i + 1].maxTime === s.maxTime ? '' : ` ${utils.format24Hours(s.minTime)} to ${utils.format24Hours(s.maxTime)}`}`).join(', ')}\n\n`
			}
			if (embed.description === '') embed.description = 'None.'
			return message.say('', embed)
		}

		// Validate/convert given params.
		const eventInfo = this.client.eventInfo.find(event => event.name.toLowerCase().includes(eventName.toLowerCase()));
		if (!eventInfo) return message.say(`Couldn't find an event by that name.`);
		else eventName = eventInfo.name;

		if (!worldNames) worldNames = ['Connery', 'Miller', 'Cobalt', 'Emerald', 'Soltech'];
		if (!Array.isArray(worldNames)) worldNames = worldNames.split(' ').filter(name => name !== '');

		const worldIDs = worldNames
			.map(name => Object.keys(this.client.worldMap).find(world_id => this.client.worldMap[world_id].toLowerCase().includes(name.toLowerCase())))
			.filter(id => id !== undefined);
		if (worldIDs.length === 0) worldIDs = [1, 10, 13, 17, 40];
		
		// Get Time interval
		await message.say('Please send a message with the 24-hour time interval for which you\'d like to receive notifications. ' +
			'(i.e. to receive notifications from 10AM to 2PM, send "1000 1400)\nTo receive notifications 24/7, send "0".');
		
		let response = await message.channel.awaitMessages(msg => msg.author.id == message.author.id, { max: 1, time: 120000, errors: ['time'] })
			.catch(() => console.log('Time ran out, canceling event subscription.'));
		if (!response) return message.say('Didn\'t get a response, canceling event subscription.');
		let interval = response.first().content.split(' ');
		let minTime = Number(interval[0]);
		let maxTime = Number(interval[1]);
		if (minTime === 0) {
			minTime = 0;
			maxTime = 2359;
		}
		if (isNaN(minTime) || isNaN(maxTime)) return message.say(`Couldn't parse time interval (NaN). Canceling event subscription.`);

		if (!this.client.timezones.has(message.author.id)) {
			message.say(`Please provide a timezone to reference.`);
			await new TimezoneCommand(this.client).run(message).catch(async (e) => {
				console.log(e);
				message.say(`Error while saving timezone. Defaulting to GMT, use !timezone to change.`);
				await this.client.db.query(`INSERT INTO timezones VALUES (?, "GMT", 0);`, [message.author.id])
				this.client.updateTableCaches('timezones');
			});
		}

		// Insert into DB.
		await this.client.db.query(`INSERT INTO eventSubs VALUES ${'(?, ?, ?, ?, ?),'.repeat(worldIDs.length).slice(0, -1)} ON DUPLICATE KEY UPDATE minTime = VALUES(minTime), maxTime = VALUES(maxTime);`, worldIDs.map(id => [message.author.id, eventName, id, minTime, maxTime]).flat())
			.catch(e => console.error(`Error saving event subscription: ${e}`));
		
		this.client.updateTableCaches('eventSubs');

		let min = utils.format24Hours(minTime);
		let max = utils.format24Hours(maxTime);

		message.say(`Success! - You will now be pinged when the **${eventName}** event starts${minTime !== -1 ? ` from ${min} to ${max} hours` : ''} on servers: **${worldIDs.map(name => this.client.worldMap[name]).join(', ')}**`);
	}
}