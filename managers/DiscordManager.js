const reactionEmojis = ['381325006761754625', '🤔', '😂', '😭'];
const {getAllServerStatus_OnLogin} = require('../ps2_functions/utils.js');


class DiscordManager {

	constructor() {

	}

	async init (client) {

		client.registry
			.registerDefaultTypes()
			.registerDefaultGroups()
			.registerDefaultCommands({
				help: false,
				eval_: false
			})
			.registerGroups([
				['public', 'Commands for anyone.'],
				['planetside', 'Commands for anyone that do something planetside related.'],
				['dev', 'Commands for developers.'],
				['admin', 'Commands for server admins']
			])
			.registerCommandsIn(__dirname + '/../commands');

		await this.registerListeners(client);

		client.login(process.env.token);
	}

	async registerListeners (client) {

		client.on('messageReactionAdd', async (msgReaction, reactor) => {

			let message = msgReaction.message;

			// Get this guild's data. If this guild doesn't have data, it means an admin hasn't set it up so return.
			if (!message.guild) return;
			let guildSData = client.guildSSData[message.guild.id];
			if (!guildSData) return;
		
			// Only allow administrators to configure.
			if (!message.guild.members.get(reactor.id).hasPermission('ADMINISTRATOR') && reactor.id !== '520652944622878744' && guildSData.prompt_message_id == message.id) return msgReaction.remove(reactor);
			
			// If the reactor is this bot, or the reaction emoji doesn't match those below, return.
			if (reactor.id == client.user.id || ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'].every((emote) => msgReaction.emoji.name != emote)) return;
		
			// Start typing to show that the reaction was processed
			message.channel.startTyping();
		
			let world_id = client.emoji_to_WorldID_Map[msgReaction.emoji.name];
		
			// Push to updates.
			if (!client.guildWorldData[message.guild.id].worlds.includes(world_id)) client.guildWorldData[message.guild.id].worlds.push(world_id);
			client.updates[message.guild.id] = { worldIDs: client.guildWorldData[message.guild.id].worlds }
		});

		client.on('messageReactionRemove', async (msgReaction, reactor) => {

			// shorthand variable
			let message = msgReaction.message;
			
			// Get this guild's data. If this guild doesn't have data, it means an admin hasn't set it up so return.
			if (!message.guild) return;
			let guildSData = client.guildSSData[message.guild.id];
			if (!guildSData) return;

			// Only allow administrators to configure.
			if (!message.guild.members.get(reactor.id).hasPermission('ADMINISTRATOR') && reactor.id !== '520652944622878744' && guildSData.prompt_message_id == message.id) return msgReaction.remove(reactor);

			// If the reactor is this bot, or the reaction emoji doesn't match those below, return.
			if (reactor.id == client.user.id || ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'].every((emote) => msgReaction.emoji.name != emote)) return;

			// Start typing to show that the reaction was processed
			message.channel.startTyping();
			
			let world_id = client.emoji_to_WorldID_Map[msgReaction.emoji.name]

			// Push to updates.
			if (client.guildWorldData[message.guild.id].worlds.includes(world_id))
				client.guildWorldData[message.guild.id].worlds = client.guildWorldData[message.guild.id].worlds.filter(id => id !== world_id);
			client.updates[message.guild.id] = { worldIDs: client.guildWorldData[message.guild.id].worlds }
		});

		client.on('message', message => {
			if (Math.floor(Math.random() * 70) + 1 == 1) message.react(reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)]);
		});

		client.on('ready', async () => {

			console.log('Bot logged in.\n--------------');
			client.user.setActivity('PlanetSide 2');
			client.startedTimestamp = Date.now();

			getAllServerStatus_OnLogin(client);
		});

		client.on("guildMemberAdd", (member) => {

			let channel = member.guild.channels.find(c => c.name.includes('welcome') || c.name.includes('general'));
			if (channel && channel.type == "text") channel.send(`Another soldier enlists. Welcome ${member.user} to the battle!`);
		});

		client.on('error', e => console.log(e));
		return true;
	}
}

module.exports = DiscordManager