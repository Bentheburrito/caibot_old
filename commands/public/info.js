const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

module.exports = class InfoCommand extends commando.Command {

    constructor(client) {
        super(client, {
            name: 'info',
            group: 'public',
            memberName: 'info',
            description: 'Get info/links related to the bot. __Usage:__ !info',
            throttling: {
                usages: 1,
                duration: 60
            }
        });
    }

    async run (message) {
        
		const embed = new RichEmbed()
			.setTitle('Confederation of Auraxian Information Bot - A hobby project by Snowful#1513')
			.setDescription('Use !help to see a list of all public commands.\nInvite Link: https://discord.com/oauth2/authorize?client_id=520652944622878744&scope=bot&permissions=1409674320')
			// .addField('Links', 'GitHub: \n')
			.addField('Planetside Features', `-Search for characters, outfits, weapons, and character/weapon stats.\n-Subscribe to alert & event notifications on your server(s) within a time window.\n-View your latest play session in detail, with over-time performance comparison.\n-View unlocked continents and their events on every server.`);
		message.embed(embed);
    }
};