const commando = require('discord.js-commando');

module.exports = class TrackCommand extends commando.Command {

    constructor(client) {
        super(client, {
            name: 'track',
            group: 'dev',
            memberName: 'track',
            description: 'Add user to track on Websocket.',
            argsPromptLimit: 0,
            args: [
                {
                    key: 'id',
                    prompt: 'Not a number',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run (message, { id }) {

		if (message.author.id !== '254728052070678529') return;

		await this.client.db.query(`INSERT INTO trackedUsers VALUES (?);`, [id]);
		message.say(`:ok_hand: pls restart`);
    }
};