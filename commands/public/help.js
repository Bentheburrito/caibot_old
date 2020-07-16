const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

module.exports = class HelpCommand extends commando.Command {
	constructor(client) {
		super(client, {
			name: 'help',
			group: 'public',
			memberName: 'help',
			description: 'List available public commands.\n__Usage:__ !help *<commandName>',
			argsPromptLimit: 0,
			throttling: {
                usages: 2,
                duration: 60
            },
			args: [
				{
					key: 'commandName',
					prompt: '',
					type: 'string',
					default: '',
					validate: () => true
				}
			]
		});
	}
	
	async run (message, { commandName }) {

		let embed = new RichEmbed()
			.setColor(this.client.colorMap[Math.floor(Math.random() * this.client.colorMap.length)])
			.setFooter('* means optional argument');

		if (!commandName) {

			let planetsideCommands = this.client.registry.groups.find(group => group.id === 'planetside');
			if (!planetsideCommands) return message.say('Couldn\'t get planetside commands.');
			let pubCommands = this.client.registry.groups.find(group => group.id === 'public');
			if (!pubCommands) return message.say('Couldn\'t get public commands.');
			let adminCommands = this.client.registry.groups.find(group => group.id === 'admin');
			if (!adminCommands) return message.say('Couldn\'t get admin commands.');

			embed.setTitle('Command Overview')
			embed.setDescription('Use !help commandName to view a command\'s full details with examples.')
			embed.addField('Planetside Commands:', planetsideCommands.commands.map(c => `**${this.client.commandPrefix}${c.name} ${c.aliases.length > 0 ? `(${c.aliases.map(a => this.client.commandPrefix + a).join('/')})` : ''}**\n${c.description.split(`.`)[0] + '.'}`).join('\n-\n'), true)
			embed.addField('Public Commands:', pubCommands.commands.map(c => `**${this.client.commandPrefix}${c.name} ${c.aliases.length > 0 ? `(${c.aliases.map(a => this.client.commandPrefix + a).join('/')})` : ''}**\n${c.description.split(`.`)[0] + '.'}`).join('\n-\n'), true)
			embed.addField('Admin Commands:', adminCommands.commands.map(c => `**${this.client.commandPrefix}${c.name} ${c.aliases.length > 0 ? `(${c.aliases.map(a => this.client.commandPrefix + a).join('/')})` : ''}**\n${c.description.split(`.`)[0] + '.'}`).join('\n-\n'), true)

			message.say('Sending command list to your DMs.');
			return message.author.send('', embed);
		}
		let foundCommands = this.client.registry.findCommands(commandName.toLowerCase(), true);
		if (foundCommands.length === 0) return message.say('Couldn\'t find a command by that name.');
		let command = foundCommands[0];

		embed.setTitle(`${this.client.commandPrefix}${command.name} ${command.aliases.length > 0 ? `(${command.aliases.map(a => this.client.commandPrefix + a).join('/')})` : ''}`);
		embed.setDescription(command.description);
		message.say('', embed);
	}
}
