const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');

module.exports = class OutfitTagCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'outfittag',
            aliases: ['ot', 'tag'],
            group: 'planetside',
            memberName: 'outfittag',
            description: 'View an outfit\'s members and collective stats.\n__Usage:__ !outfittag <tag>',
            throttling: {
                usages: 4,
                duration: 60
            },
            argsPromptLimit: 0,
            args: [
                {
                    key: 'outfitTag',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }
	
    async run (message, { outfitTag }) {

        if (!outfitTag) return message.say('You need to provide an outfit name.');
        outfitTag = outfitTag.replace(" ", "%20")

        // API Query
        let outfit = await request({
            url: `${this.client.queryStart}outfit/?alias_lower=${outfitTag.toLowerCase()}&c:join=type:outfit_member^inject_at:outfit_id^list:1^inject_at:members^show:character_id'rank_ordinal'rank(type:character^show:name'faction_id^inject_at:character(characters_online_status^inject_at:status^hide:character_id))`,
            json: true
        }).catch(e => console.log(e));

        // Data checks
        if (!outfit || outfit.error) {
            console.log(outfit.error);
            return message.say('An error occured while fetching outfit info. Please wait a bit before trying again.');
        }
        if (outfit.returned == 0) return message.say('Didn\'t find a outfit by that name.');

        outfit = outfit.outfit_list[0];
        let factionID = outfit.members[0].character.faction_id;

        const factionMap = this.client.factionMap;
        const colorMap = this.client.colorMap;
        const imageMap = this.client.imageMap;

        // Filter out offline outfit members
        outfit.members = outfit.members.filter(m => m.character && m.character.status.online_status > 0);
        // Sort online player list from highest rank to lowest
		outfit.members = outfit.members.sort((m1, m2) => m1.rank_ordinal - m2.rank_ordinal)
		
		let timezone = this.client.timezones.has(message.author.id) ? this.client.timezones.get(message.author.id).timezone : 'GMT';

        var embed = new RichEmbed()
            .addField(`${outfit.name} [${outfit.alias}]`, `${factionMap[factionID]} - ${outfit.member_count} members`)
            .addField(`Online Members (${outfit.members.length}):\nName / Rank (Rank Ordinal)`, outfit.members.length > 0 ?
                outfit.members.map(member => `**${member.character.name.first}** / *${member.rank}* (${member.rank_ordinal})`).join('\n') : 'No members are online')
            .setColor(colorMap[factionID])
            .setThumbnail(imageMap[factionID])
            .setFooter(`Waging war since ${new Date(outfit.time_created * 1000).toLocaleDateString("en-US", { timeZone: timezone })}`)
        message.embed(embed);
    }
}