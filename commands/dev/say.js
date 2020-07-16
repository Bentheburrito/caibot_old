const commando = require('discord.js-commando');

module.exports = class SayCommand extends commando.Command {

    constructor(client) {
        super(client, {
            name: 'say',
            group: 'dev',
            memberName: 'say',
            description: 'Have the bot say something.',
            argsPromptLimit: 0,
            args: [
                {
                    key: 'botMessage',
                    prompt: 'Please specify something for the bot to say.',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run (message, {botMessage}) {

		if (!message.member || message.author.id !== '254728052070678529') return;

        message.delete().catch(() => console.log('Error deleting message'));
        var toChannel = message.channel;
        
        if (botMessage.startsWith('to ')) {
            
            botMessage = botMessage.slice(3);
            let chanName = botMessage.split(' ')[0];
            toChannel = await message.guild.channels.find(channel => channel.name.includes(chanName));

            if (!toChannel || toChannel.type != 'text') return message.channel.send("Couldn't find channel (or it's not a text channel).");
            botMessage = botMessage.slice(chanName.length);
        }

        while (botMessage.includes('@ ')) {

            var toTag = await botMessage.split('@ ')[1].split(' ')[0];
            var member = message.guild.members.find(member => member.displayName.toLowerCase().includes(toTag.toLowerCase()));
            
            botMessage = botMessage.replace(`@ ${toTag}`, member);
        }
        toChannel.send(botMessage);
    }
};