const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');

const timeutils = require('../../utils/timeutils.js');

module.exports = class CharacterCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'character',
            aliases: ['c', 'char'],
            group: 'planetside',
            memberName: 'character',
            description: 'View a character\'s general info and online status.\n__Usage:__ !character <name>',
            throttling: {
                usages: 3,
                duration: 60
            },
            argsPromptLimit: 0,
            args: [
                {
                    key: 'charName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }
	
    async run (message, { charName }) {

        if (!charName) return message.say('You need to provide a character name.');
		if (charName.includes(' ')) return message.say('Character names can\'t have spaces in them silly :cat:');
		if (charName.length < 3) return message.say('Please specify at least 3 characters in the character name.');

        // API Query
        let character = await request({
            url: `${this.client.queryStart}character/?name.first_lower=*${charName.toLowerCase()}&c:exactMatchFirst=true&c:resolve=outfit,online_status,world&c:join=type:title^inject_at:title^show:name.en`,
            json: true
        }).catch(e => console.log(e));

        // Data checks
        if (!character || character.error) return message.say('An error occured while fetching character info. Please wait a bit before trying again.');
        if (character.returned == 0) return message.say('Didn\'t find a character by that name.');

        message.channel.startTyping();

        // Short hand vars
        character = character.character_list[0];

        let title = "";
        if (character.title_id != 0) title = character.title.name.en;

        let factionID = character.faction_id;

        const factionMap = this.client.factionMap;
        const colorMap = this.client.colorMap;
        const imageMap = this.client.imageMap;
        const worldMap = this.client.worldMap;

		let sessionMS = (this.client.socketManager.activeSessions.has(character.character_id) ? this.client.socketManager.activeSessions.get(character.character_id).loginTimestamp : character.times.last_login) * 1000;
		let sessionStamp = timeutils.getTimeUntil(Date.now() - sessionMS, false);
		
		let timezone = this.client.timezones.has(message.author.id) ? this.client.timezones.get(message.author.id).timezone : 'GMT';

        // Message embed
        var embed = new RichEmbed()
			.setTitle(`${character.outfit ? `[${character.outfit.alias}]` : ''}${character.title_id != 0 ? ` ${character.title.name.en}` : ''} ${character.name.first}`)
			.setDescription(`${worldMap[character.world_id]}, ${factionMap[factionID]}, ${character.outfit ? character.outfit.name : 'No outfit'}`)
            .addField(`Battle Rank ${character.battle_rank.value}`, `Prestige level: ${character.prestige_level}`)
            .addField(`${Math.floor(character.times.minutes_played / 60)} hours in game`, `Obtained ${parseInt(character.certs.earned_points) + parseInt(character.certs.gifted_points)} certs over lifetime`)
            .setColor(colorMap[factionID])
            .setThumbnail(imageMap[factionID])
            .setFooter(character.online_status > 0 ? `Online for ${sessionStamp} - ${character.character_id}` : `Offline - Last seen ${new Date(character.times.last_save * 1000).toLocaleDateString("en-US", { timeZone: timezone })} - ${character.character_id}`,
				character.online_status > 0 ? "https://i.imgur.com/hxZ9HC4.png" : "https://i.imgur.com/KenvqDV.png")
        
        message.embed(embed);
        message.channel.stopTyping(true);
    }
}