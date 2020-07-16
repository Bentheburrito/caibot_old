const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');
const ps2 = require('../../ps2_functions/utils.js');
const CWSCommand = require('./characterweaponstats.js')

module.exports = class StatsCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'stats',
            aliases: ['s', 'stat', 'cstat'],
            group: 'planetside',
            memberName: 'stats',
            description: 'View a character\'s lifetime stats.\n__Usage:__ !stats <character name> *<weapon name>',
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
		if (charName.length < 3) return message.say('Please specify at least 3 characters in the character name.');
        if (weaponName) return new CWSCommand(this.client).run(message, {charName, weaponName});

        // API Query
        let charStats = await request({
            url: `${this.client.queryStart}character/?name.first_lower=*${charName.toLowerCase()}&c:exactMatchFirst=true&c:show=character_id,name,faction_id,times.creation,times.minutes_played,times.last_save&c:join=characters_stat_history^list:1^terms:stat_name=kills%27stat_name=deaths'stat_name=facility_capture'stat_name=facility_defend^show:stat_name%27all_time^inject_at:lifetime_stats,characters_stat_by_faction^inject_at:faction_stats^terms:stat_name=weapon_vehicle_kills^list:1^show:character_id%27stat_name%27profile_id%27value_forever_vs%27value_forever_nc%27value_forever_tr%27last_save,characters_stat^inject_at:shot_stats^list:1^terms:stat_name=weapon_deaths^show:stat_name%27value_forever%27last_save,characters_weapon_stat_by_faction^list:1^inject_at:weapon_faction_stats^hide:character_id'last_save'last_save_date^terms:stat_name=weapon_headshots'stat_name=weapon_kills'vehicle_id=0'item_id=!0(item^inject_at:weapon^show:name.en'item_category_id^terms:item_category_id=3'item_category_id=5'item_category_id=6'item_category_id=7'item_category_id=8'item_category_id=12'item_category_id=19'item_category_id=24'item_category_id=100'item_category_id=102),characters_weapon_stat^list:1^inject_at:weapon_shot_stats^show:stat_name'item_id'vehicle_id'value^terms:stat_name=weapon_hit_count'stat_name=weapon_fire_count'stat_name=weapon_deaths'vehicle_id=0'item_id=!0(item^inject_at:weapon^show:name.en'item_category_id^terms:item_category_id=3'item_category_id=5'item_category_id=6'item_category_id=7'item_category_id=8'item_category_id=12'item_category_id=19'item_category_id=24'item_category_id=100'item_category_id=102)`,
            json: true
        }).catch(e => console.log(e));

        // Data checks
        if (!charStats || charStats.error) return message.say('An error occured while fetching character statistics. Please wait a bit before trying again.');
        if (charStats.returned == 0) return message.say('Didn\'t find a character by that name.');

        charStats = charStats.character_list[0];
        if (!charStats.lifetime_stats || !charStats.faction_stats) return message.say(`Can't display profile of ${charStats.name.first}. Missing stat data.`)

        message.channel.startTyping();

        let factionID = charStats.faction_id;

		// Unused for now
        // let facilitiesCaptured = charStats.lifetime_stats.find(s => s.stat_name === "facility_capture").all_time;
        // let facilitiesDefended = charStats.lifetime_stats.find(s => s.stat_name === "facility_defend").all_time;
        let kills = parseInt(charStats.lifetime_stats.find(s => s.stat_name === "kills").all_time);
        let deaths = parseInt(charStats.lifetime_stats.find(s => s.stat_name === "deaths").all_time);

        // Vehicle kills
        let vKills = charStats.faction_stats.find(s => s.stat_name === "weapon_vehicle_kills");
        vKills = parseInt(vKills.value_forever_vs) + parseInt(vKills.value_forever_tr) + parseInt(vKills.value_forever_nc);

        // Infantry Headshot kills, Infantry kills, Infantry HSR
        let iHsKills = 0;
        charStats.weapon_faction_stats.forEach(item => {
            if (!item.weapon || item.stat_name !== "weapon_headshots") return;
            iHsKills += parseInt(item.value_vs) + parseInt(item.value_tr) + parseInt(item.value_nc);
        })
        let iKills = 0;
        charStats.weapon_faction_stats.forEach(item => {
            if (!item.weapon || item.stat_name !== "weapon_kills") return;
            iKills += parseInt(item.value_vs) + parseInt(item.value_tr) + parseInt(item.value_nc);
        })
        let hsr = (100 * (iHsKills / iKills)).toFixed(2);
        let iDeaths = 0;
        charStats.weapon_shot_stats.forEach(item => {
            if (!item.weapon || item.stat_name !== "weapon_deaths") return;
            iDeaths += parseInt(item.value);
        })

        // Infantry shots hit, Infantry shots fired, infantry accuracy
        let shotsHit = 0;
        let shotsFired = 0;
        charStats.weapon_shot_stats.forEach(item => {
            if (!item.weapon) return;
            if (item.stat_name === "weapon_hit_count") shotsHit += parseInt(item.value);
            if (item.stat_name === "weapon_fire_count") shotsFired += parseInt(item.value);
        });

		let accuracy = (100 * (shotsHit / shotsFired)).toFixed(2);
		
		let timezone = this.client.timezones.has(message.author.id) ? this.client.timezones.get(message.author.id).timezone : 'GMT';

        // Message embed
		let embed = new RichEmbed()
			.setTitle(charStats.name.first)
			.addField(`Lifetime Stats`, ps2.newStatDescription({
				playerKills: kills,
				vehicleKills: vKills,
				playerDeaths: deaths,
				KDR: (kills / deaths).toFixed(2),
				KPM: (kills / charStats.times.minutes_played).toFixed(2),
				created: `${new Date(charStats.times.creation * 1000).toLocaleDateString("en-US", { timeZone: timezone })} (m/d/y)`,
				timeInGame: `${(charStats.times.minutes_played / 60).toFixed(2)} hrs`,
				lastSeen: new Date(charStats.times.last_save * 1000).toLocaleDateString("en-US", { timeZone: timezone }),
			}, [3, 5]), true)
			.addField(`Infantry vs. Infantry`, ps2.newStatDescription({
				HSR: hsr + '%',
				Acc: accuracy + '%',
				score: (hsr * accuracy).toFixed(2),
				KDR: (iKills / iDeaths).toFixed(2),
				SPK: (shotsFired / iKills).toFixed(2),
				HPK: (shotsHit / iKills).toFixed(2)
			}), true)
            .setColor(this.client.colorMap[factionID])
            .setFooter(charStats.character_id, this.client.imageMap[factionID])
        message.embed(embed);
        message.channel.stopTyping(true);
    }
}
