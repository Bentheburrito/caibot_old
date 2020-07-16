const commando = require('discord.js-commando');

module.exports = class UnsubscribeCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'unsubscribe',
			aliases: ['unsub'],
			group: 'planetside',
			memberName: 'unsubscribe',
			description: 'Unsubscribe from an event. Note: If `eventName` is more than one word, wrap it in quotes (example below.)\n__Usage:__ !unsubscribe "<eventName>" <serverName1> <serverNameX> ...\n\n__Examples:__\n**!unsub "aerial anomalies" connery miller** - unsubscribe to Aerial Anomalies events on Connery and Miller\n**!sub "refine and refuel"** - unsubscribe to Refine and Refuel events on __all servers__\n\nUse !events for a list of accepted events.',
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

		// Update DB.
		await this.client.db.query(`DELETE FROM eventSubs WHERE subscriber_id = ? AND event_name = ? AND world_id IN (${'?,'.repeat(worldIDs.length).slice(0, -1)});`, [message.author.id, eventName, worldIDs].flat())
			.catch(e => console.error(`Error saving event subscription: ${e}`));
		
		this.client.updateTableCaches('eventSubs');

		message.say(`Success! - You will no longer be pinged when the **${eventName}** event starts on servers: **${worldIDs.map(name => this.client.worldMap[name]).join(', ')}**`);
	}
}