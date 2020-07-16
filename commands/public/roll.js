const commando = require('discord.js-commando');

module.exports = class DiceRollCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'roll',
			group: 'public',
			memberName: 'roll',
			description: 'Rolls a virtual dice. \n__Usage:__ !roll <# of sides> (Defaults to 6).',
			argsPromptLimit: 0,
			throttling: {
                usages: 12,
                duration: 60
            },
			args: [
				{
					key: 'sides',
					prompt: '',
					type: 'integer',
					default: '',
					validate: () => true
				}
			]
		});
	}
	
	async run (message, { sides }) {

		if (isNaN(sides)) return message.channel.send("Please use numbers only");
		if (!sides) sides = 6;

		let roll = Math.floor(Math.random() * sides) + 1;
		message.channel.send(`${message.author.username} rolled ${roll}`);
	}
}
