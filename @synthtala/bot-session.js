const Path = require('path');
const Filesystem = require('fs-extra');
const Moment = require('moment-timezone');
const BotLogin = require('../@fb-chat-api');
const Logger = require(Path.resolve(`${__dirname}/../utilities/logger.js`));

let CLIENT,
	MODULES,
	APPSTATE,
	APPSTATE_PATH,
	APPSTATE_FILENAME;

// ────────────────────────────── # EVENTS: RECEIVE DATA FROM PARENT ──────────────────────────────
process.on('message', function ( data ) {
	
	const msg_signal = data.message;
	
	switch (msg_signal) {
		case '-start':
			start( data );
			break;
		case '-update':
			CLIENT = (data.CLIENT) ? data.CLIENT : CLIENT;
			MODULES = (data.CLIENT.MODULES) ? data.CLIENT.MODULES : MODULES;
			break;
		default:
			break;
	}
	return;
});

function start( input ) {
	
	CLIENT = input.CLIENT;
	MODULES = input.CLIENT.MODULES;
	APPSTATE = input.APPSTATE;
	APPSTATE_FILENAME = input.APPSTATE_FILENAME;
	APPSTATE_PATH = input.APPSTATE_PATH;
	
	const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
	
	const Login = new Promise(function (resolved, reject) {
		const appState = JSON.parse(APPSTATE);
		BotLogin({ appState }, async function (BOT_ERROR, API) {
			if (BOT_ERROR) {
				const msg = `Authentication error while logging: ${APPSTATE_FILENAME}`;
				Logger(msg, 'login');
				Logger.makeLog(CLIENT.LOG_PATH, `${msg}\n${BOT_ERROR}`);
				console.error(BOT_ERROR);
				resolved( { ERROR: true, PATH: APPSTATE_PATH, API } );
			}
			API.setOptions(CLIENT.CONFIG.FCAOption);
					
			// Rename file e.g: "1097657886555777.json"
			const ID = await API.getCurrentUserID();
			const PATH = Path.join(CLIENT.APPSTATE_PATH, `${ID}.json`);
			if (!Filesystem.existsSync(PATH) && APPSTATE_FILENAME !== '<Environment Variable>') {
				Filesystem.unlinkSync(APPSTATE_PATH);
				Filesystem.writeJsonSync(PATH, appState, { spaces: '\t' });
				APPSTATE_PATH = PATH;
				APPSTATE_FILENAME = `${ID}.json`;
			}
			resolved({ ID, API, PATH });
		});
	});


	Login.then(async function ( LoginData ) {
		
		if ( LoginData.ERROR ) {
			/// Delete This appstate
			if (!LoginData.PATH.includes('100074862181079.json')) { // exclude Alyanna
				if (LoginData.PATH !== '' && APPSTATE_FILENAME !== '<Environment Variable>') {
					Logger.makeLog(CLIENT.LOG_PATH, `Deleting ${LoginData.PATH} ...`, 'warn');
					Filesystem.unlinkSync(LoginData.PATH);
					Logger.makeLog(CLIENT.LOG_PATH, `Appstate was deleted!!`, 'warn');
				}
			}
			process.exit(0);
		}
		
		/// Initialize Database
		const database = `${LoginData.ID}.sqlite`;
		const db_name = `${CLIENT.ROOT_PATH}/@synthtala/database/datas/${database}`;
		const { sequelize, Sequelize } = require('./database/db_auth.js')(db_name);
		await sequelize.authenticate(); // opening database

		const { API } = LoginData;
		
		/// AppStateSaver
		const saveAppState = async function () {
			try {
				if (APPSTATE_FILENAME !== '<Environment Variable>') {
					const appstate = await API.getAppState();
					Filesystem.writeJsonSync(APPSTATE_PATH, appstate, { spaces: '\t' });
				}
			} catch (err) {
				return console.error(err);
			}
		}
		
		/// Get Table Models
		const get_db_models = require('./database/db_models.js');
		await get_db_models({ sequelize, Sequelize }).then(async (Models) => {
			
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${LoginData.ID} » Database Models Initialized!, Processing pre-listening procedure...`, 'database');
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${LoginData.ID} » Fetching Controllers...`, 'bot');
			
			const textFormat = Filesystem.readJsonSync(Path.join(CLIENT.ROOT_PATH, 'json', 'ref-textFormat.json'));
			const { Bans, Users, Threads, Commands } = getDBControllers({ API, textFormat, Models });
			
			/// EXTENDING BOT INFO
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${LoginData.ID} » Fetching Bot Information & Utilities...`, 'bot');
			
			const BOT_INFO = {}
			const bot_info = await Users.getInfo(String(LoginData.ID));
			BOT_INFO.ID = bot_info.id || LoginData.ID;
			BOT_INFO.URL = `facebook.com/${BOT_INFO.USERNAME}`;
			BOT_INFO.NAME = bot_info.first_name;
			BOT_INFO.FULLNAME = bot_info.name;
			BOT_INFO.USERNAME = bot_info.username || bot_info.id;
			BOT_INFO.AVATAR_LINK = bot_info.avatar;
			BOT_INFO.DATABASE_NAME = database;
			BOT_INFO.APPSTATE_NAME = APPSTATE_FILENAME;
			BOT_INFO.STARTTIME = Date.now();
			
			/// UTILITY FUNCTIONALITIES
			const Utils = await (require('../utilities/utils.js')).INTERNAL({ API, BOT_INFO, CLIENT, Bans, Users, Threads, Commands });
			const Message = require('./messageHelper.js');

			/// FETCH HANDLERS
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Preparing Handlers...`, 'bot');
			const handler_inputs = { CLIENT, BOT_INFO, Bans, Users, Threads, Utils, Logger };
			
			const handler_Event = require('./handler/handleEvent.js')(handler_inputs);
			const handler_Database = require('./handler/handleDatabase.js')(handler_inputs);
			const handler_Command = require('./handler/handleCommand.js')(handler_inputs);
			const handler_CommandReply = require('./handler/handleCommandReply.js')(handler_inputs);
			const handler_CommandEvent = require('./handler/handleCommandEvent.js')(handler_inputs);
			const handler_CommandReaction = require('./handler/handleCommandReaction.js')(handler_inputs);
			
			/// DATABASE RECHECKING
			await handler_Database.init({ API, CLIENT, BOT_INFO });
			
			API.markAsReadAll((err) => {
				if (err) {
					Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Unable to mark all messages as read on start up.`);
				}
			});
			
			/// INITIALIZE CHARACTER AI
			Logger.makeLog(CLIENT.LOG_PATH, `Authenticating AI Characters...`, 'login');
			const characterAI = require(Path.join(CLIENT.ROOT_PATH, 'utilities', '/initCharacterAI.js'));
			const CharacterAI = await characterAI.authenticate(CLIENT.ROOT_PATH, Logger);
			
			/// START UP NOTIFY MAIN GROUP CHATS
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Notifying Administrators.`, 'bot');
			const notifiedID = {};
			
			const time = Moment().tz('Asia/Manila').format('MMMM DD, YYYY • HH:mm');
			for (const id of [ ...CLIENT.CONFIG.botOwners, ...CLIENT.CONFIG.botAdmins ]) {
				if (!notifiedID[id]) {
					API.sendMessage(
						{
							body: Utils.textFormat('system', 'startUpNotif', time),
							// attachment: log//Path.join(CLIENT.CACHE_PATH, ''keep', 'welcome_members.gif'));
						},
						id,
						(err) => {}	
					);
					notifiedID[id] = true;
				}
			}
			*/
			
			/// PREPARE INITIAL INPUTS
			const Inputs = { API, CLIENT, MODULES };
			Inputs.CharacterAI = CharacterAI;
			
			/// LISTENER CALLBACK

			const callbackListenTime = {};
			const messageCache = [];
			
			const stopListening = function () {
				const target = Object.keys(callbackListenTime).pop();
				return new Promise((resolve) => {
					if (target) {
						callbackListenTime[key] = () => {};
						delete callbackListenTime[key];
						resolve();
					} else {
						resolve();
					}
				});
			}
			
			const listenerCallback = async function (listen_err, event) {
				
				if (listen_err) {
					handleListenerError (listen_err, saveAppState, CLIENT, BOT_INFO);
				} else {
					
					if (event.type == 'message' && event.messageID) {
						if (messageCache.includes(event.messageID)) {
							Object.keys(callbackListenTime).slice(0, -1).forEach(key => {
								callbackListenTime[key] = () => {};
								delete callbackListenTime[key];
							});
						} else {
							messageCache.push(event.messageID);
							if (messageCache.length > 5) {
								messageCache.shift();
							}
						}
					}
				
					event.body = (event.body !== undefined) ? event.body : '';
					
					Inputs.Message = await Message({ event, API, Utils });
					Inputs.HandleCommandReaction = handler_CommandReaction;
					Inputs.HandleCommandReply = handler_CommandReply;
					Inputs.HandleDatebase = handler_Database;
					Inputs.event = event;
				
					switch (event.type) {
						case 'message':
						case 'message_reply':
						case 'message_unsend':
						case 'message_reaction':
							handler_Database.check(Inputs).then(async () => {
								await handler_Command.listen(Inputs);
								await handler_CommandEvent.listen(Inputs);
								await handler_CommandReply.listen(Inputs);
								await handler_CommandReaction.listen(Inputs);
							}).catch((err) => {
								Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » ${err}`, 'listener');
								Logger.makeLog(CLIENT.LOG_PATH, err);
								console.error(err);
							});
							break;
						case 'event':
							handler_Event.listen(Inputs);
							break;
						case 'presence':
							break;
						case 'read_receipt':
							break;
						case 'typ':
							break;
						default:
							break;
					}
				}
			}
			
			const createListnerCallback = function () {
				const key_id = Date.now();
				callbackListenTime[key_id] = listenerCallback;
				return callbackListenTime[key_id];
			}
			
			/// START LISTENING
			await stopListening();
			CLIENT.Listener = API.listenMqtt(createListnerCallback());
			CLIENT.lastListenTime = Date.now();
			
			setInterval(async function () {
				const timenow = Date.now();
				const uptime = Math.abs(BOT_INFO.STARTTIME - timenow);
				const listener_uptime = Math.abs(CLIENT.lastListenTime - timenow);
				// restart listen every 5hrs
				if (listener_uptime >= 18000000) {
					try {
						await CLIENT.Listener.stopListeningAsync().then(async (data) => {
							await sleep(1000);
							CLIENT.Listener = API.listenMqtt(createListnerCallback());
							CLIENT.lastListenTime = Date.now();
							Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » BOT listening is restarted`, 'bot');
							console.log(data);
						});
					} catch (err) {
						Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » ERROR Restart Listening!`, 'bot');
						console.error(err);
					}
					/*
					await process.send(
						{
							id: BOT_INFO.ID,
							message: '-restart',
							name: BOT_INFO.FULLNAME,
						}
					);
					*/
				}
			}, (60 * 1000) * 2);
			
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Started Listening...`, 'bot');
		
			// Inform parent process that we're done logging this account
			return await process.send(
				{
					id: BOT_INFO.ID,
					message: '-logged',
					name: BOT_INFO.FULLNAME,
					start_time: BOT_INFO.STARTTIME,
					process_time: Math.abs(BOT_INFO.STARTTIME - Date.now())
				}
			);
			
		}).catch(async (Model_Err) => {
			
			/// if database creation is unsuccessful
			Logger(Model_Err, 'error');
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${LoginData.ID} » Unable to create database model for this account, Exiting process...`, 'database');
			Logger.makeLog(CLIENT.LOG_PATH, Model_Err);
			await saveAppState();
			process.exit(0);
		});
	});
}

let error_count = 0
async function handleListenerError (listen_error, saveAppState, CLIENT, BOT_INFO) {
	console.error(listen_error.error);
	Logger(`Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Error occured while listening, Kindly check Logs.txt for more info`, 'listener');
	Logger.makeLog(CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Listen Error:\n${listen_error.error}`);
	
	if (error_count < 10) {
		if (listen_error.type && listen_error.type === 'account_inactive') {
			await saveAppState();
			process.exit(0);
		}
	} else {
		await saveAppState();
		process.exit(0);
	}
}

function getDBControllers ( inputs ) {
	
	const controllerPath = Path.join(CLIENT.ROOT_PATH, '@synthtala', 'database', 'controllers');

	const Bans = require(Path.join(controllerPath, 'controller_bans.js'))(inputs);
	const Users = require(Path.join(controllerPath, 'controller_users.js'))(inputs);
	const Threads = require(Path.join(controllerPath, 'controller_threads.js'))(inputs);
	const Commands = require(Path.join(controllerPath, 'controller_commands.js'))(inputs);
		
	return { Bans, Users, Threads, Commands };
}