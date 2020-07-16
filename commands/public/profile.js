const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

module.exports = class ProfileCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'profile',
			group: 'public',
			memberName: 'profile',
			description: 'View someone\'s PS2 Status Discord profile.\n__Usage:__ !profile *<Discord username>',
			argsPromptLimit: 0,
			throttling: {
                usages: 5,
                duration: 60
            },
			args: [
				{
					key: 'user',
					prompt: '',
					type: 'user',
					default: '',
					validate: () => true
				}
			]
		});
	}
	
	async run (message, { user }) {

		if (!user) user = message.author;

		const userTimezoneInfo = this.client.timezones.get(user.id);
		if (!userTimezoneInfo) return message.say(`User has no info to display on their profile.`);

		let embed = new RichEmbed()
			.setAuthor(user.tag, user.avatarURL)
			.setColor(this.client.colorMap[Math.floor(Math.random() * this.client.colorMap.length)])
			.addField('Linked Characters:', `Coming soon™.`)
			.addField('Timezone', `${userTimezoneInfo.public === 1 ? this.client.timezoneMap[userTimezoneInfo.timezone] : `Undisclosed`}.`)
		message.say('', embed);
	}
}
