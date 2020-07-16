const express = require('express');
const { exec } = require('child_process');

// Pulls latest changes from master branch when it is updated.
class DeployManager {

	constructor(client) {
		this.app = express();
		this.app.use(express.static('public'));
		this.app.use(express.json());

		this.registerListeners(client);
	}

	async registerListeners (client) {
		this.app.get("/", (request, response) => {
			console.log(Date.now() + " Ping Received");
			response.sendStatus(200);
		});

		this.app.post("/deployhook/", async (request, response) => {

			let refArray = request.body.ref.split('/');
			let branchName = refArray[refArray.length - 1];

			if (request.query.secret && request.query.secret == process.env.sauce && branchName != 'development') {
				await client.guilds.get('381258048527794197').channels.get('381258231613227020').send('New push to master detected, pulling from GitHub...');

				exec(`git checkout -- ./ && git pull git@github.com:Bentheburrito/ps2status master`, async (e, stdout, stderror) => {
					if (e) {
						console.log(e);
						response.send(e).status(500)
						return;
					}
					console.log(`stdout: ${stdout}`);
					console.log(`stderror: ${stderror}`);

					response.sendStatus(200);
					await client.guilds.get('381258048527794197').channels.get('381258231613227020').send('GitHub pull successful, restarting...');

					exec(`pm2 reload caibot`)
				});
			}
			else response.sendStatus(200);
		});
		this.app.listen(process.env.PORT, () => console.log(`Listening for pings on ${process.env.PORT}`));
	}
}

module.exports = DeployManager;