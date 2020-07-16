const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');

module.exports = class OutfitCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'outfit',
            aliases: ['o', 'out'],
            group: 'planetside',
            memberName: 'outfit',
            description: 'View an outfit\'s members and collective stats.\n__Usage:__ !outfit <name/tag>',
            throttling: {
                usages: 4,
                duration: 60
            },
            argsPromptLimit: 0,
            args: [
                {
                    key: 'outfitName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }
	
    async run (message, { outfitName }) {

        if (!outfitName) return message.say('You need to provide an outfit name.');
        outfitName = outfitName.replace(" ", "%20")

        // API Queries
        var outfit;
        if (outfitName.length <= 4) {
            outfit = await request({
                url: `${this.client.queryStart}outfit/?alias_lower=${outfitName.toLowerCase()}&c:join=type:outfit_member^inject_at:outfit_id^list:1^inject_at:members^show:character_id'rank_ordinal'rank(type:character^show:name'faction_id^inject_at:character(characters_stat_history^list:1^inject_at:stats^terms:stat_name=kills'stat_name=deaths^show:stat_name'all_time,characters_online_status^inject_at:status^hide:character_id))`,
                json: true
            }).catch(e => console.log(e));
        }
        if (!outfit || outfit.returned == 0) {
            outfit = await request({
                url: `${this.client.queryStart}outfit/?name_lower=${outfitName.toLowerCase()}&c:join=type:outfit_member^inject_at:outfit_id^list:1^inject_at:members^show:character_id'rank_ordinal'rank(type:character^show:name'faction_id^inject_at:character(characters_stat_history^list:1^inject_at:stats^terms:stat_name=kills'stat_name=deaths^show:stat_name'all_time,characters_online_status^inject_at:status^hide:character_id))`,
                json: true
            }).catch(e => console.log(e));
        }
        // Data checks
        if (outfit.error) {
            console.log(outfit.error);
            return message.say('An error occured while fetching outfit info. Please wait a bit before trying again.');
        }
        if (outfit.returned == 0) return message.say('Didn\'t find a outfit by that name.');

        outfit = outfit.outfit_list[0];
        let factionID;
        for (let i = 0; i < outfit.members.length; i++) {
            if (outfit.members[0].character && outfit.members[0].character.faction_id) {
                factionID = outfit.members[0].character.faction_id;
                break;
            }
        } 

        let outfitKills = 0;
        let outfitDeaths = 0;

        outfit.members.forEach(m => {
            if (!m.character || !m.character.stats) return;

            outfitKills += parseInt(m.character.stats.find(s => s.stat_name === "kills").all_time);
            outfitDeaths += parseInt(m.character.stats.find(s => s.stat_name === "deaths").all_time);
        })
        let kdr = Math.round(100 * (outfitKills / outfitDeaths)) / 100;

        // Filter out offline outfit members
        outfit.members = outfit.members.filter(m => m.character && m.character.status.online_status > 0);
        // Sort online player list from highest rank to lowest
		outfit.members = outfit.members.sort((m1, m2) => m1.rank_ordinal - m2.rank_ordinal)
		
		let timezone = this.client.timezones.has(message.author.id) ? this.client.timezones.get(message.author.id).timezone : 'GMT';

        var embed = new RichEmbed()
            .addField(`${outfit.name} [${outfit.alias}]`, `${this.client.factionMap[factionID]} - ${outfit.member_count} members\nAvg. KDR: ${kdr}`)
            .addField(`Online Members (${outfit.members.length}):\nName / Rank (Rank Ordinal)`, outfit.members.length > 0 ?
                outfit.members.map(member => `**${member.character.name.first}** / *${member.rank}* (${member.rank_ordinal})`).join('\n') : 'No members are online')
            .setColor(this.client.colorMap[factionID])
            .setThumbnail(this.client.imageMap[factionID])
            .setFooter(`Waging war since ${new Date(outfit.time_created * 1000).toLocaleDateString("en-US", { timeZone: timezone })}`)
        message.embed(embed);
    }
}