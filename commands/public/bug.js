const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');

module.exports = class BugCommand extends commando.Command {

    constructor(client) {
        super(client, {
            name: 'bug',
            group: 'public',
            memberName: 'bug',
            description: 'Report a bug with PS2 Status Bot\n__Usage:__ !bug <bug description>',
            argsPromptLimit: 0,
            throttling: {
                usages: 1,
                duration: 60
            },
            args: [
                {
                    key: 'details',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run (message, { details }) {
        
        if (!details) {
            message.say('Please send a message that describes the problem in *as much detail as possible*, and steps to reproduce.')
            details = await message.channel.awaitMessages(msg => msg.author.id == message.author.id, { max: 1, time: 600000, errors: ['time'] })
                .catch(() => console.log('Bug report timeout'))

            if (!details) return message.say('Bug report aborted, no details provided')
            else details = details.first().content;
        }

        let embed = new RichEmbed()
            .addField(`${message.author.username} said`, details)
        	.setColor('#ffa500')
        await this.client.owners[0].send(`Bug report from ${message.author.username}#${message.author.discriminator} in ${message.guild ? `'${message.guild.name}'` : 'a DM chat'}`, embed)
        message.say('Bug report successfully sent - Thank you!')
    }
};