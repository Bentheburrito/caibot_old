const commando = require('discord.js-commando');
const { RichEmbed } = require('discord.js');
const request = require('request-promise');
const ps2 = require('../../ps2_functions/utils.js');

module.exports = class WeaponCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'weapon',
            aliases: ['w', 'weapon', 'wstat'],
            group: 'planetside',
            memberName: 'weapon',
            description: 'View weapon info (Damage, clip size, etc.).\n__Usage:__ !weapon <weapon name>',
            throttling: {
                usages: 4,
                duration: 60
            },
            argsPromptLimit: 0,
            args: [
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
    
    async run (message, { weaponName }) {        

        if (!weaponName) return message.say('You need to provide a weapon name (or part of one).');
        if (weaponName.length < 3) return message.say('Please specify at least 3 characters in the weapon name.');

        // API Query
        let weaponStats = await request({
            url: `${this.client.queryStart}item/?name.en=*${weaponName.toLowerCase()}&c:case=false&c:show=item_id,item_category_id,is_vehicle_weapon,name.en,description.en,faction_id,image_id,is_default_attachment&c:limit=10&c:join=weapon_datasheet^inject_at:weapon^show:damage'damage_min'damage_max'fire_cone'fire_rate_ms'reload_ms'clip_size'capacity'range.en&item_category_id=!99&item_category_id=!103&item_category_id=!105&item_category_id=!106&item_category_id=!107&item_category_id=!108&item_category_id=!133&item_category_id=!134&item_category_id=!135&item_category_id=!136&item_category_id=!137&item_category_id=!139&item_category_id=!140&item_category_id=!141&item_category_id=!142&item_category_id=!143&item_category_id=!145&item_category_id=!148`,
            json: true
        }).catch(e => console.log(e));

        // Data checks
        if (!weaponStats || weaponStats.error || weaponStats.errorCode) return message.say('An error occured while fetching weapon info. Please wait a bit before trying again.');
        if (weaponStats.returned == 0) return message.say('Didn\'t find a weapon by that name.');

        message.channel.startTyping();

        let uniqItems = {}
        weaponStats = weaponStats.item_list.filter(item => item.weapon && !item.name.en.includes('AE'));
        weaponStats = weaponStats.filter(item => uniqItems.hasOwnProperty(item.description.en) ? false : uniqItems[item.description.en] = true);

        if (weaponStats.length === 0) {
            message.channel.stopTyping(true);
            return message.say('Didn\'t find a weapon by that name.');
        }

        if (weaponStats.length > 1) {            

            let itemList = new RichEmbed().setTitle('Multiple items found')
                .setDescription('Please react accordingly to the items below.')
            
            for (var i = 0; i < weaponStats.length; i++) {
                let item = weaponStats[i];

                itemList.addField(`${this.client.reactionMap[i]} for ${item.name.en}`, item.description.en.split('.')[0])
            }

            let prompt = await message.say('', itemList);

            for (var i = 0; i < weaponStats.length; i++) await prompt.react(this.client.reactionMap[i])

            let response = await prompt.awaitReactions((reaction, user) => this.client.reactionMap.includes(reaction.emoji.name) && user.id === message.author.id, { max: 1 })
            prompt.delete();
            
            weaponStats = weaponStats[this.client.reactionMap.indexOf(response.first().emoji.name)]
        } else weaponStats = weaponStats[0];
        
        // Message embed
        var embed = new RichEmbed()
            .setTitle(weaponStats.name.en)
			.addField('Stats', ps2.newStatDescription({
				damage: weaponStats.weapon.damage,
				RPM: Math.round(weaponStats.weapon.fire_rate_ms / 1000 * 60),
				reloadSpeed: weaponStats.weapon.reload_ms / 1000 + 's',
				magazineSize: weaponStats.weapon.clip_size
			}), true)
            .addField('Description', `*${weaponStats.description.en}*`)
        message.embed(embed);
        message.channel.stopTyping(true);
    }
}
