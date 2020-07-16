const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const { orderedReact, updateGuildData } = require('../../ps2_functions/utils.js')

module.exports = class SetStatusChannelCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'setstatuschannel',
            group: 'admin',
            memberName: 'setstatuschannel',
            description: 'Set the channel to post an updated server status message.\n__Usage:__ !ssc *<channelName>',
            aliases: ['ssc'],
			argsPromptLimit: 0,
			throttling: {
                usages: 2,
                duration: 60
            },
            guildOnly: true,
            args: [
                {
                    key: 'channelName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run (message, { channelName }) {

		if (!message.member.hasPermission('ADMINISTRATOR')) return;

		// If no channelName is provided, use message.channel.
        let channel = !channelName ? message.channel : message.guild.channels.find(c => c.name.includes(channelName) && c.type == 'text');

		// Send the prompt message.
        var embed = new RichEmbed()
            .setTitle('Settings Prompt')
            .addField('Select a server to monitor by reactiong accordingly.',
                ':one: for Connery\n:two: for Miller\n:three: for Cobalt\n:four: for Emerald\n:five: for SolTech')
            .setFooter('Changes may take a few seconds to update.')
        let promptMessage = await channel.send('', embed);

		// If this guild has no data, insert a new record for it.
        if (!this.client.guildSSData[message.guild.id]) {

			this.client.guildSSData[message.guild.id] = { channel_id: channel.id, message_id: -1, prompt_message_id: promptMessage.id };

			await this.client.db.query('INSERT INTO guildInfo VALUES (?, ?, "-1", ?);', [message.guild.id, channel.id, promptMessage.id])
				.catch(e => console.log(e));
			updateGuildData(this.client)
			message.say('Successfully saved new status channel');
			
        } else { // Otherwise find its record and update it.
			this.client.guildSSData[message.guild.id].channel_id = channel.id;
			this.client.guildSSData[message.guild.id].prompt_message_id = promptMessage.id;
			await this.client.db.query(`UPDATE guildInfo SET channel_id = ?, prompt_message_id = ? WHERE guild_id = ?;`, [channel.id, promptMessage.id, message.guild.id])
			updateGuildData(this.client);
            message.say('Successfully changed status channel');
		}
		// Add the option reactions for ease of use.
		orderedReact(promptMessage, ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣']);
    }
}