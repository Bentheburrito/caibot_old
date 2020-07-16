const mysql = require('mysql2/promise');
const logger = require('../utils/logutils.js');

class DatabaseManager {

	constructor() {

	}

	async init () {
		await this.newPool();

		if (!this.pool) return console.log(`Couldn't connect to db`);
		console.log('Connected to Database.');

		await this.registerListeners();
	}

	async newPool () {
		this.pool = await mysql.createPool({
			host: process.env.host,
			user: process.env.user,
			password: process.env.password,
			database: process.env.database,
			connectionLimit: 15,
			charset: 'utf8mb4'
		});
		return true;
	}

	// Query the DB, returns rows.
	async query (query, data) {
		if (!data) {
			const [rows, fields] = await this.pool.execute(query).catch(e => logger.logError(`DatabaseManager.query("${query}") - QUERY FAILED:`, e));
			return rows;
		}
		const [rows, fields] = await this.pool.execute(query, data).catch(e => logger.logError(`DatabaseManager.query("${query}", ${data}) - QUERY FAILED:`, e));
		return rows;
	}

	async registerListeners () {

		this.pool.on('error', (e) => {
			this.newPool();
			logger.logError(e);
		});
	}

	// Helper methods to gather table data easily.
	async fetch_timezones ()  {
		const rows = await this.query(`SELECT * FROM timezones;`);
		let timezones = new Map();
		for (const row of rows) {
			timezones.set(row.id, { timezone: row.timezone, public: row.public });
		}
		return timezones;
	}
	async fetch_eventSubs () {
		const rows = await this.query(`SELECT * FROM eventSubs;`);
		return rows;
	}
	async fetch_publicRoles () {
		const rows = await this.query(`SELECT * FROM publicRoles;`);
		return rows.map(row => row.id);
	}
	async fetch_guildInfo() {
		const rows = await this.query('SELECT * FROM guildInfo;');
		return rows;
	}
}

module.exports = DatabaseManager;