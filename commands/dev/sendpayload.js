const commando = require('discord.js-commando');

module.exports = class SendpayloadCommand extends commando.Command {

    constructor(client) {
        super(client, {
            name: 'sendpayload',
            group: 'dev',
            memberName: 'sendpayload',
            aliases: ['test', 'pay'],
            description: 'Send test data.',
            args: [
                {
					key: 'world',
					prompt: '',
					type: 'string',
					default: '',
					validate: () => true
				},
				{
					key: 'state',
					prompt: '',
					type: 'string',
					default: '',
					validate: () => true
				}
			],
			ownerOnly: true
        });
    }

	async run (message, { world, state }) {

		if (message.author.id !== '254728052070678529') return;

        if (!state) state = '135';
        if (!world) world = '1';
        this.client.socketManager.censusSocket.emit('message', JSON.stringify({ payload: 
            { event_name: 'MetagameEvent',
              experience_bonus: '0.000000',
              faction_nc: '0.000000',
              faction_tr: '0.000000',
              faction_vs: '0.000000',
              instance_id: '23067',
              metagame_event_id: '125',
              metagame_event_state: state,
              metagame_event_state_name: 'custom',
              timestamp: Math.floor(Date.now() / 1000),
              world_id: world },
            service: 'event',
            type: 'serviceMessage'
        }))
        if (message.channel.type === 'text') message.delete();
    }
};