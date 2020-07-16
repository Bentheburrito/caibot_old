const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const { orderedReact } = require('../../ps2_functions/utils');

module.exports = class TimezoneCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'timezone',
			group: 'public',
			memberName: 'timezone',
			description: 'Set your time zone for event/continent alerts. __Usage__: !timezone',
			throttling: {
                usages: 2,
                duration: 60
            },
		});
	}
	
	async run (message) {
		
		let embed = new RichEmbed()
			.setDescription(`Don't see your timezone? You can convert [here](https://www.timeanddate.com/worldclock/converter.html).`)
			.addField('React according to your prefered timezone below:',
				`:one: - Hawaii Standard Time :flag_us:
				:two: - Pacific Time :flag_us:
				:three: - Eastern Time :flag_us:
				:four: - Brasilia Time :flag_br:
				:five: - Greenwich Mean Time :flag_gb:
				:six: - Central European Time :flag_eu:
				:seven: - Eastern European Time :flag_eu:
				:eight: - China Standard Time :flag_cn:
				:nine: - Australian Western Standard Time :flag_au:
				:keycap_ten: - New Zealand Time :flag_nz:`)
		let prompt = await message.say('', embed);

		orderedReact(prompt, this.client.reactionMap);

		let response = await prompt.awaitReactions((reaction, user) => this.client.reactionMap.includes(reaction.emoji.name) && user.id === message.author.id, { max: 1 })

		response = response.first();
		prompt.delete();

		prompt = await message.say('The C.A.I. Bot features a !profile command which other users can use to view certain info about you (including your saved timezone)\nReact with :white_check_mark: to allow others to view your timezone on your profile, or :x: to mark it private.\nWill default to private in 1 minute.');
		
		orderedReact(prompt, ['✅', '❌']);

		let publicTzRes = await prompt.awaitReactions((reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id, { max: 1, time: 60000 });

		let showTimezone = false;
		publicTzRes = publicTzRes.first();
		prompt.delete();

		if (publicTzRes && publicTzRes.emoji.name == '✅') showTimezone = true;

		let timezone = Object.keys(this.client.timezoneMap)[this.client.reactionMap.indexOf(response.emoji.name)];
		if (this.client.timezones.has(message.author.id)) await this.client.db.query(`UPDATE timezones SET timezone = ?, public = ? WHERE id = ?;`, [timezone, showTimezone, message.author.id])
		else await this.client.db.query(`INSERT INTO timezones VALUES (?, ?, ?);`, [message.author.id, timezone, showTimezone])
		this.client.updateTableCaches('timezones');
		
		message.say(`Successfully saved ${showTimezone ? 'public' : 'private'} timezone.`);		
	}
}
