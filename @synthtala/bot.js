const Path = require('path');
const Filesystem = require('fs-extra');
const Moment = require('moment-timezone');
const BotLogin = require('ws3-fca');
const Logger = require(Path.resolve(`${__dirname}/../utilities/logger.js`));
const DBModels = require('./database/db_models.js');

// ----------------- GLOBAL  ----------------- //
const GLOBAL = {};


function getDBControllers ( inputs ) {
	
	const controllerPath = Path.join(GLOBAL.CLIENT.DATA_PATH, 'database', 'controllers');

	const Bans = require(Path.join(controllerPath, 'controller_bans.js'))(inputs);
	const Users = require(Path.join(controllerPath, 'controller_users.js'))(inputs);
	const Threads = require(Path.join(controllerPath, 'controller_threads.js'))(inputs);
	const Commands = require(Path.join(controllerPath, 'controller_commands.js'))(inputs);
		
	return { Bans, Users, Threads, Commands };
}


function start (input) {
	
	// Store values to GLOBAL
	for (let key in input) {
		GLOBAL[key] = input[key];
	}
	
	const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
	
	// Login Promises
	const Login = new Promise(function (resolved, reject) {
		
		const appState = JSON.parse(GLOBAL.APPSTATE);
		let fcaOption = GLOBAL.CLIENT.CONFIG.FCAOption;
		fcaOption.userAgent = GLOBAL.USER_AGENT;
		
		BotLogin({ appState }, fcaOption, async function (authError, API) {
			if (authError) {
				reject(authError);
			}
			resolved({ API });
		});
	});
	
	Login.then( async ({ API }) => {
		/// Initialize Database
		const database = `${GLOBAL.ID}.sqlite`;
		const databaseName = `${GLOBAL.CLIENT.DATA_PATH}/database/datas/${database}`;
		const { sequelize, Sequelize } = require('./database/db_auth.js')(databaseName);
		await sequelize.authenticate();
		
		// GET MODELS & START
		await DBModels({ sequelize, Sequelize }).then(async (Models) => {
			
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${GLOBAL.ID} » Database Models Initialized!, Processing pre-listening procedure...`, 'database');
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${GLOBAL.ID} » Fetching Bot Information & Utilities...`, 'bot');
			
			const textFormat = Filesystem.readJsonSync(Path.join(GLOBAL.CLIENT.ROOT_PATH, 'json', 'ref-textFormat.json'));
			const { Bans, Users, Threads, Commands } = getDBControllers({ API, textFormat, Models });
			
			// EXTEND BOT INFORMATION
			const BOT_INFO = {};
			BOT_INFO.ID = GLOBAL.ID;
			BOT_INFO.DATABASE_NAME = database;
			BOT_INFO.APPSTATE_NAME = GLOBAL.APPSTATE_FILENAME;
			BOT_INFO.STARTTIME = process.uptime();
			
			/// UTILITY FUNCTIONALITIES
			const Utils = await (require('../utilities/utils.js')).INTERNAL({ GLOBAL, API, BOT_INFO, Bans, Users, Threads, Commands });
			const Message = require('./messageHelper.js');
			
			/// FETCH HANDLERS
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${GLOBAL.ID} » Preparing Handlers...`, 'bot');
			const handler_inputs = { GLOBAL, BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger };
			
			const handler_Event = require('./handler/handleEvent.js')(handler_inputs);
			const handler_Database = require('./handler/handleDatabase.js')(handler_inputs);
			const handler_Command = require('./handler/handleCommand.js')(handler_inputs);
			const handler_CommandReply = require('./handler/handleCommandReply.js')(handler_inputs);
			const handler_CommandEvent = require('./handler/handleCommandEvent.js')(handler_inputs);
			const handler_CommandReaction = require('./handler/handleCommandReaction.js')(handler_inputs);
			
			/// DATABASE RECHECKING
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Checking Databases.`, 'bot');
			await handler_Database.init({ API });
			
			/// PREPARE INITIAL INPUTS
			const Inputs = { API };
			Inputs.CLIENT = GLOBAL.CLIENT;
			Inputs.MODULES = GLOBAL.MODULES;
			
			// Inform parent process that we're done logging this account
			await process.send(
				{
					code: '-logged',
					id: BOT_INFO.ID,
					start_time: BOT_INFO.STARTTIME,
					process_time: process.uptime() - BOT_INFO.STARTTIME
				}
			);
			
			API.listenMqtt(async (err, event) => {
				if (err) {
					console.error(err);
				} else if (event && event.type == 'message') {
					API.sendMessage(event.body, event.threadID);
				}
			});

		}).catch(async (modelError) => {
			
			Logger(modelError, 'error');
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${GLOBAL.ID} » Unable to create database model for this account, Exiting process...`, 'database');
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, modelError);
			process.exit(0);
		});
		
	}).catch((authError) => {
		// Failed authentication
		const msg = `Authentication error while logging: ${GLOBAL.APPSTATE_FILENAME}`;
		Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `${msg}\n${authError}`, 'login');
		console.error(authError);
		process.exit(0);
	});
}


// ----------------- COMMUNICATIONS BETWEEN PARENT AND CHILD ----------------- //

process.on('message', function ( data ) {
	
	switch (data.code) {
		case '-start': 
			start(data);
			break;
		case '-update':
		
			break;
		default:
			break;
	};
	
});