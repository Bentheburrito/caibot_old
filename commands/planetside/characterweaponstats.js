const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');

const utils = require('../../utils/timeutils.js')
const { checkDenom } = require('../../ps2_functions/misc.js');
const { newStatDescription } = require('../../ps2_functions/utils.js');

const requiredStatFields = [
    'weapon_damage_given',
    'weapon_deaths',
    'weapon_fire_count',
    'weapon_headshots',
    'weapon_hit_count',
    'weapon_kills',
    'weapon_play_time',
	'weapon_score'
];

module.exports = class CharacterWeaponStatsCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'characterweaponstats',
            aliases: ['cws', 'ws', 'wstats', 'cw', 'charw'],
            group: 'planetside',
            memberName: 'characterweaponstats',
            description: 'View a character\'s weapon stats.\n__Usage:__ !characterweaponstats <character name> <weapon name>',
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
                },
                {
                    key: 'weaponName',
                    prompt: '',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }
    
    async run (message, { charName, weaponName }) {        

        if (!charName) return message.say('You need to provide a character name.');
        if (!weaponName) return message.say('You need to provide a weapon name.');
        if (weaponName.length < 3) return message.say('Please specify at least 3 characters in the weapon name.');

        // Check if weaponName is (or is a part of) the name of a weapon, and correct its capitalization (API doesn't support case insensitivity in c:join's).
        let match;
        this.client.weaponNames.some(w => {
            if (match = w.replace(/[\s-]/g, '').match(new RegExp(weaponName.replace(/[\s-]/g, ''), 'i'))) {
                let excusedChars = (w.slice(0, match.index).match(/[\s-]/) || []).length

				match = w.slice(match.index + excusedChars, match.index + match[0].length + 1);
                return true;
            }
        });

        // If weaponName didn't match with anything, return.
		if (!match) return message.say('No weapon found by that name.');
        weaponName = match;

        // API Query
        let character = await request({
            url: `${this.client.queryStart}character_name?name.first_lower=*${charName.toLowerCase()}&c:exactMatchFirst=true&c:join=characters_weapon_stat^on:character_id^inject_at:w_stats^list:1^terms:item_id=!0^show:item_id'stat_name'vehicle_id'value'last_save(item^inject_at:weapon^terms:name.en=*${weaponName}^case:0^outer:0^show:name.en'description.en'faction_id),characters_weapon_stat_by_faction^on:character_id^inject_at:w_stats_f^list:1^terms:item_id=!0^show:item_id'stat_name'vehicle_id'value_vs'value_tr'value_nc'last_save(item^inject_at:weapon^terms:name.en=*${weaponName}^case:0^outer:0^show:name.en'description.en'faction_id)`,
            json: true
        }).catch(e => console.log(e));

        // Data checks
		if (!character || character.error) return message.say('An error occured while fetching character weapon info. Please wait a bit before trying again.');
		if (character.character_name_list.length == 0) return message.say(`Didn't find a character by that name.`);
        character = character.character_name_list[0];

        // The API won't allow combination of two lists, so just combining them clientside.
        if (!character.w_stats || !character.w_stats_f) return message.say(`No weapon stats for ${character.name.first} (Insufficient data).`)
        character.weaponStats = character.w_stats.concat(character.w_stats_f);
        delete character.w_stats;
        delete character.w_stats_f;
        // Filter out non-weapon items, aniversery weapons (AE), and certain unused fields.
        let weaponsFound = {}

        message.channel.startTyping();

        character.weaponStats = character.weaponStats.filter(item => item.weapon && !item.weapon.name.en.includes('AE') && !['weapon_damage_taken_by', 'weapon_killed_by', 'weapon_vehicle_kills'].some(field => field === item.stat_name));
        // Collect weapon names and stats under those names.
        character.weaponStats.forEach(item => weaponsFound.hasOwnProperty(item.weapon.name.en) ? weaponsFound[item.weapon.name.en].statNames.push(item.stat_name) : weaponsFound[item.weapon.name.en] = { statNames: [item.stat_name], desc: item.weapon.description.en});
        let choices = Object.keys(weaponsFound)

        // Determine whether the character has used a weapon enough to populate the fields required to make calculations with.
        character.weaponStats.forEach(item => {

            if (!weaponsFound[item.weapon.name.en]) return; // Each iteration of the forEach is async - this should prevent an index from being accessed/deleted twice.
            
            // If one or more required stat fields are missing, remove the weapon from consideration.
            let names = weaponsFound[item.weapon.name.en].statNames.sort();
            if (names.length !== requiredStatFields.length) return delete weaponsFound[item.weapon.name.en];
            for (let i = 0; i < names.length; i++) {
                if (names[i] !== requiredStatFields[i]) return delete weaponsFound[item.weapon.name.en];
            }
            return;
        });
        let keys = Object.keys(weaponsFound);

        // If none of the weapons met field requirements, return letting the user know.
        if (keys.length === 0) {
            message.channel.stopTyping(true)
            return message.say(`No weapon stats for ${character.name.first} (Insufficient data for ${choices.join(', ')}).`);
        }
        // If more than one weapon met field requirements, ask the user which they were searching for...
        if (keys.length > 1) {

            let itemList = new RichEmbed().setTitle('Multiple items found')
                .setDescription('Please react accordingly to the items below.')
            for (var i = 0; i < keys.length; i++) {

                itemList.addField(`${this.client.reactionMap[i]} for ${keys[i]}`, weaponsFound[keys[i]].desc.split('.')[0])
            }

            let prompt = await message.say('', itemList);

            for (var i = 0; i < keys.length; i++) await prompt.react(this.client.reactionMap[i])

            let response = await prompt.awaitReactions((reaction, user) => this.client.reactionMap.includes(reaction.emoji.name) && user.id === message.author.id, { max: 1 })
            prompt.delete();

            // Add selection
            character.weaponStats = character.weaponStats.filter(item => item.weapon.name.en === keys[this.client.reactionMap.indexOf(response.first().emoji.name)])
        }        
        character.weaponStats = character.weaponStats.filter(item => keys.includes(item.weapon.name.en));
        
        // From this point on it's assume there is only one weapon's stats in character.weaponStats
        
        // -Collect and calculate data-
        let kills = character.weaponStats.find(s => s.stat_name === "weapon_kills");
        kills = parseInt(kills.value_vs) + parseInt(kills.value_tr) + parseInt(kills.value_nc);
        let deaths = parseInt(character.weaponStats.find(s => s.stat_name === "weapon_deaths").value);

        let headshotKills = character.weaponStats.find(s => s.stat_name === "weapon_headshots");
        headshotKills = parseInt(headshotKills.value_vs) + parseInt(headshotKills.value_tr) + parseInt(headshotKills.value_nc);
        let hsr = Math.round(10000 * (headshotKills / kills)) / 100;

        // Infantry shots hit, Infantry shots fired, infantry accuracy
        let shotsHit = parseInt(character.weaponStats.find(s => s.stat_name === "weapon_hit_count").value);
        let shotsFired = parseInt(character.weaponStats.find(s => s.stat_name === "weapon_fire_count").value);

        let accuracy = Math.round(10000 * (shotsHit / shotsFired)) / 100;
        let score = parseInt(character.weaponStats.find(s => s.stat_name === "weapon_score").value)
        let playTimeSeconds = parseInt(character.weaponStats.find(s => s.stat_name === "weapon_play_time").value);

        let factionID = character.weaponStats[0].weapon.faction_id && character.weaponStats[0].weapon.faction_id != 0 ? character.weaponStats[0].weapon.faction_id : 4;

        // Create and send the embed.
        let embed = new RichEmbed()
            .setTitle(character.name.first)
			.addField(character.weaponStats[0].weapon.name.en + (kills >= 1160 ? ' <:araxium_medal:682872297513812001>' : ''),
			newStatDescription({
				kills,
				deaths,
				KDR: (kills / checkDenom(deaths)).toFixed(2),
				HSR: hsr + '%',
				Acc: accuracy + '%',
				[`IVI Score`]: (hsr * accuracy).toFixed(2),
				KPM: ((kills / checkDenom(playTimeSeconds)) * 60).toFixed(2),
				SPK: (shotsFired / checkDenom(kills)).toFixed(2),
				HPK: (shotsHit / checkDenom(kills)).toFixed(2),
				score,
				timeUsed: utils.getTimeUntil(playTimeSeconds * 1000, false)
			}, [3, 6, 9]), true)
            .setColor(this.client.colorMap[factionID])
        	.setFooter(`From the arsenal of ${factionID === 4 ? this.client.factionMap[factionID] : `the ${this.client.factionMap[factionID]}`}`, this.client.imageMap[factionID])
        message.embed(embed);
        message.channel.stopTyping(true)
    }
}
