const commando = require('discord.js-commando');

module.exports = class RoleCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'role',
            group: 'public',
            memberName: 'role',
            description: 'Assign and remove roles.\n__Usage:__ !role <rollName>',
			argsPromptLimit: 0,
			throttling: {
                usages: 6,
                duration: 60
            },
            args: [
                {
                    key: 'roleName',
                    prompt: 'Please specify a role name.',
                    type: 'string',
                    default: '',
					validate: () => true
                }
            ]
        });
    }

    async run(message, {roleName}) {

        if (!roleName) return message.channel.send("Please provide arguments (Usage: !role <roleName>).");

        if (roleName.startsWith('add')) {

            if (!message.member.hasPermission("MANAGE_ROLES")) return message.channel.send("You do not have permission to add a role for public use.");
            roleName = roleName.slice(4);
			
            let roleToAdd = message.guild.roles.find(roleToAdd => roleToAdd.name.toLowerCase().includes(roleName.toLowerCase()));
            if (!roleToAdd) return message.channel.send("Couldn't find role to add.");

            if (this.client.publicRoles.includes(roleToAdd.id)) return message.channel.send("That role is already available for public use.");
            
			await this.client.db.query(`INSERT INTO publicRoles VALUES (?)`, [roleToAdd.id]);
			this.client.updateTableCaches('publicRoles');

            return message.channel.send(`Added new role for public use: '${roleToAdd.name}'.`);
        }

        let member = message.member;
        let desiredRole = message.guild.roles.find(role => role.name.toLowerCase().includes(roleName.toLowerCase()));
        if (!desiredRole) return message.channel.send("Role not found.");

        if (!this.client.publicRoles.includes(desiredRole.id)) return message.say('That role cannnot be self assigned.');

        if (member.roles.find(role => role.name === desiredRole.name)) {
            member.removeRole(desiredRole);
            return message.say(`Removed role '${desiredRole.name}'`);
        } else {
            member.addRole(desiredRole);
            return message.say(`Assigned role '${desiredRole.name}'`);
        }
    }
};
