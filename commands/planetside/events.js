const commando = require('discord.js-commando');

module.exports = class EventListCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'events',
			group: 'planetside',
			memberName: 'events',
			description: 'View a list of in-game events to subscribe to.',
			throttling: {
				usages: 8,
				duration: 60
			},
			argsPromptLimit: 0
		});
	}

	async run (message) {

		const eventNames = this.client.eventInfo.map(event => event.name).filter((event, pos, arr) => arr.indexOf(event) == pos);
		message.author.send(eventNames.join(', '));
		message.say('List of events sent to DMs.');
	}
}