const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');

module.exports = class StatusCommand extends commando.Command {
    constructor(client) {
        super(client, {
			name: 'status',
			aliases: ['server'],
            group: 'planetside',
            memberName: 'status',
            description: 'Quickly get a server\'s online status.\n__Usage:__ !status <server name>',
			argsPromptLimit: 0,
			throttling: {
                usages: 5,
                duration: 60
            },
            args: [
                {
                    key: 'serverName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run (message, { serverName }) {

        let id = Object.keys(this.client.worldMap).find(key => this.client.worldMap[key].toLowerCase() === serverName.toLowerCase());
        if (id == undefined) return message.say('Couldn\'t find that server.');

        let server = await request({
            url: `${this.client.queryStart}world/?world_id=${id}`,
            json: true
        }).catch(e => console.log(e));
        if (server.error || server.errorCode) return message.say('An error occured while fetching server status. Please wait a bit before trying again.')

		server = server.world_list[0]
		
		let pops = this.client.worldPops[id];
		let totalPop = pops.reduce((total, cur) => cur + total);
		if (totalPop === 0) totalPop = 1;

		var embed = new RichEmbed()
			.setTitle(server.name.en)
			.setDescription(`<:vslogo:682819681991917660> ${pops[1]} - ${(100 * pops[1] / totalPop).toFixed(1)}% | <:nclogo:682819604414070791> ${pops[2]} - ${(100 * pops[2] / totalPop).toFixed(1)}% | <:trlogo:682819649838383134> ${pops[3]} - ${(100 * pops[3] / totalPop).toFixed(1)}% | <:nslogo:682859497487859797> ${pops[4]} - ${(100 * pops[4] / totalPop).toFixed(1)}% | :busts_in_silhouette: ${totalPop}\nStatus: ${server.state}`)
            .setColor(server.state == "online" ? '#3cea3c' : '#e52d2d')
        message.embed(embed);
    }
}