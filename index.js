'use strict';

const Moment = require('moment-timezone');
const Logger = require('./utilities/logger.js');
const ChildProcess = require('child_process');
const Filesystem = require('fs-extra');
const Chokidar = require('chokidar');
const Axios = require('axios');
const Path = require('path');

const express = require('express');
const routes = require('./utilities/loadAPIs.js');

const ejs = require('ejs');
const cors = require('cors');
const helmet = require('helmet');
const getIP = require('ipware')().get_ip;
const rate_limiter = require('express-rate-limit');

// ────────────────────────────── # INIT CLIENT ──────────────────────────────
const CLIENT = {
	
	AGENTS: {},
	
	MODULES: {},
	
	ROOT_PATH: __dirname,
	
	START_TIME: new Date().getTime(),
	
	CACHE_PATH: Path.join(__dirname, 'cache'),
	
	MODULES_PATH: Path.join(__dirname, 'modules'),
	
	LOG_PATH: Path.join(__dirname, 'cache', 'Log.txt'),
	
	OLD_LOG_PATH: Path.join(__dirname, 'cache', 'old_log.txt'),
	
	APPSTATE_PATH: Path.join(__dirname, '@synthtala', 'appstates'),
	
	CONFIG: Filesystem.readJsonSync('./json/bot_configuration.json'),
	
	CONFIG_PATH: Path.join(__dirname, 'json', 'bot_configuration.json'),
	
	COMMAND_CATEGORY_REF: Filesystem.readJsonSync('./json/ref-commandCategories.json'),
	
	SERVER_LINK: `https://synthtala-bot.onrender.com`,
	
	SIDE_SERVER_LINK: `https://hdst-api.onrender.com`
	
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

/// Copy and Make a new Log.txt > Old logs will be sent to main bot on start up
const time = Moment().tz('Asia/Manila').format('MMMM DD, YYYY');
Filesystem.writeFileSync(CLIENT.LOG_PATH, `Logs Start Date » ${time} ==================>\n`); /*(Filesystem.existsSync(CLIENT.LOG_PATH)) ? Filesystem.readFileSync(CLIENT.LOG_PATH): Filesystem.writeFileSync(CLIENT.LOG_PATH, `Logs Start Date » ${time} ==================>\n`);*/

const restartService = function () {
	return new Promise (async (resolve, reject) => {
		try {
			await Object.keys(CLIENT.AGENTS).forEach((bot_id) => {
				const session = CLIENT.AGENTS[bot_id].process;
				session.exit(0);
				delete CLIENT.AGENTS[bot_id];
			});
			loginAgents();
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}

const start_server = async function () {
	
	// CHECK & MAKE FILE TREEs
	try {
		const fileTree = require('./utilities/fileTree.js');
		const ref_fileTree = Filesystem.readJsonSync('./json/ref-FileTree.json'); 
		await fileTree.makeFileTree(ref_fileTree, __dirname);
	} catch (_err) {
		console.error(_err);
		process.exit();
	} 
	
	const port = process.env.PORT || 3000;
	const App = express();
	App.use(cors());
	App.use(helmet());
	App.use(express.json());
	// Limit each IP to max requests per windowMs
	App.use(rate_limiter({
		windowMs: 60 * 1000,
		max: 5,
		message: {
			error: 'Error: RECEIVING A LOT OF REQUEST TRY AGAIN LATER'
		}
	}));
	
	App.use((error, req, res, next) => {
	    res.status(error.status).json({ message: error.message });
	});
	
	App.set('trust proxy', 1);
	App.set('json spaces', 4);

	// Get Routes
	await routes({ express, CLIENT, Logger }).then((routers) => {
		App.use('/', routers);
		Logger.makeLog(CLIENT.LOG_PATH, `Server » Routers are successfully loaded`, '--');
	}).catch((err) => {
		Logger.makeLog(CLIENT.LOG_PATH, `Server » Error while loading Routers`, 'error');
		Logger.makeLog(CLIENT.LOG_PATH, err);
	});

	App.get('/', function (req, res) {
		res.send('hello world!');
	});
	
	
	App.get('/ip', (req, res) => res.send(req.ip));
	App.get('/running-bot', (req, res) => res.json(CLIENT.AGENTS));
	App.get('/logs', (_, res) => {
		res.sendFile(Path.join(CLIENT.CACHE_PATH, 'Log.txt'));
	});
	
	App.get('/restart-service', async function (req, res) {
	
		if (!req.query.authKey) {
			return res.status(400).json({ error: 'Missing authentication key'});
		}
	
		const authKey = req.query.authKey;
		
		if (authKey !== process.env.AUTH_KEY) {
			return res.status(401).json({ error: 'Invalid authentication key' });
		} else {
			if (process.env.IS_SERVICE_RESTARTING == 'false') {
				restartService().then(() => {
					res.status(200).json({ message: 'Service is now restarting' });
					process.env.IS_SERVICE_RESTARTING == 'true';
				}).catch((err) => {
					res.status(200).json({ error: `Unable to restart service with error: ${err}` });
				});
			} else {
				res.status(200).json({ message: 'Service is already restarting' });
			}
		}
	});
	
	await App.listen(port, () => {
		Logger.makeLog(CLIENT.LOG_PATH, `Server » ${CLIENT.SERVER_LINK}`, '--');
		Logger.makeLog(CLIENT.LOG_PATH, `Server Status » ONLINE - running on port ${port}`, '--');
		// Upload Pinger to side server
		Axios.get(encodeURI(`${CLIENT.SIDE_SERVER_LINK}/autoPing?name=Synthtala-Bot-Get&link=${CLIENT.SERVER_LINK}`)).then(()=> {}).catch(()=>{});
	});
}

// ────────────────────────────── # AGENT ──────────────────────────────

const modules = require('./utilities/moduleLoader.js');

// Watch and reload specific property
function watchAndReloadConfig ( dir, eventType, option, callback ) {
	const watcher = Chokidar.watch(dir, option);
	watcher.on('all', (event, path) => {
		if (event == eventType) {
			callback(path);
		}
	});
}

async function newSession ( appstate, appStatePath, fileName, restart) {

	let resolve, reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	
	// Parse AppState
	const util_appState = require('./utilities/appStateUtil');
	await util_appState.parse(appstate, true, CLIENT).then(async({ botID, botAppState }) => {
		
		Logger.makeLog(CLIENT.LOG_PATH, `${(restart) ? 'Restarting' : 'Starting new'} session for ${fileName}`, 'login');
			
		let child = ChildProcess.fork(`${CLIENT.ROOT_PATH}/@synthtala/bot-session.js`, null, {
			cwd: __dirname,
			stdio: 'inherit',
			shell: true,
			env: process.env
		});
		
		// Add initial contents
		const childData = {
			id: botID,
			status: 'starting',
			link: `https://www.facebook.com/${botID}`,
			path: appStatePath,
			filename: fileName,
			process: child,
		};
		
		CLIENT.AGENTS[botID] = childData;
		process.env.IS_SERVICE_RESTARTING = 'false';
		
		const message = {
			message: '-start',
			ID: botID,
			CLIENT: CLIENT,
			APPSTATE: botAppState,
			APPSTATE_FILENAME: fileName,
			APPSTATE_PATH: appStatePath
		};
		await child.send(message);
		
		child.on('close', function (code) {
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${botID} » Process was exited with code ${code}`, '--');
			delete CLIENT.ACTIVE_BOT[botID];
		});
		
		child.on('error', function ( error ) {
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${botID} ERROR » ${error}`, 'error');
			console.error(error);
			try {
				child.kill();
			} catch (e) {}
			reject(err);
		});
		
		child.on('unhandledRejection', (err) => {
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${botID} Unhandled Rejection » ${err}`, 'error');
			console.error(err);
		});
		
		child.on('uncaughtException', (err) => {
			Logger.makeLog(CLIENT.LOG_PATH, `Bot-${botID} Uncaught Exception » ${err}`, 'error');
			console.error(err);
		});
		
		child.on('message', async function ( data ) {
			const msg_signal = data.message;
			
			switch (msg_signal) {
				case '-restart': {
					child.exit(2);
					child = undefined;
					await newSession(appstate, appStatePath, fileName, true).then(() => {}).catch((err) => {
						Logger.makeLog(CLIENT.LOG_PATH, `${data.id}(${data.name}) » Error While Restarting Session`, 'error');
						Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
					});
					break;
				}
				case '-logged': {
					Logger.makeLog(CLIENT.LOG_PATH, `${data.id} Took ${data.process_time}MS To Complete`, 'login');
					Logger.makeLog(CLIENT.LOG_PATH, '─────────────────────────────────────────────', 'login');
					const restart_count = (CLIENT.AGENTS[data.id] && CLIENT.AGENTS[data.id].restart_count) ? CLIENT.AGENTS[data.id].restart_count + 1 : 0;
					// Update childData
					childData.name = data.name;
					childData.status = 'active';
					childData.restart = restart_count
					childData.start_time = data.start_time;
					
					CLIENT.AGENTS[data.id] = childData;
					
					resolve(data);
					break;
				}
				default: {
					break;
				}
			}
		});
	}).catch(reject);
		
	return promise;
}

/// OTHER FUNCTIONS
async function updateModules ( path, oldModules, addition ) {
	
	const newLoaded = await modules.load( path, CLIENT );
	
	if (addition) {
		const newEvents = {...newLoaded.events},
			newCmdAliases = {...newLoaded.cmd_aliases},
			newCmdNames = {...newLoaded.cmd_names},
			newCommands = {...newLoaded.commands};
		// Avoid Duplications
		for (const id in oldModules.events) {
			if (!id in newEvents) {
				newEvents[id] = oldModules.events[id];
			}
		}
		
		for (const id in oldModules.cmd_aliases) {
			if (!id in newCmdAliases) {
				newCmdAliases[id] = oldModules.cmd_aliases[id];
			}
		}
		
		for (const id in oldModules.cmd_names) {
			if (!id in newCmdNames) {
				newCmdNames[id] = oldModules.cmd_names[id];
			}
		}
		
		for (const id in oldModules.commands) {
			if (!id in newCommands) {
				newCommands[id] = oldModules.commands[id];
			}
		}
		
		return {
			events: newEvents,
			cmd_aliases: newCmdAliases,
			cmd_names: newCmdNames,
			commands: newCommands
		};
	}
	
	return newLoaded;
}

// ────────────────────────────── # AGENT LOGINS ──────────────────────────────
async function loginAgents() {
	
	// LOG-IN EACH CREDENTIAL AND START LISTENING
	const Credentials = Filesystem.readdirSync(CLIENT.APPSTATE_PATH).filter((file) => file.endsWith('.json') && !file.startsWith('_'));
	Logger.makeLog(CLIENT.LOG_PATH, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'login');
	
	for (const candidate of Credentials) {
		const candidatePath = Path.join(CLIENT.APPSTATE_PATH, candidate);
		const appState = require(candidatePath);
		if (!appState) {
			Logger.makeLog(CLIENT.LOG_PATH, `Appstate "${candidate}" was not a valid JSON. Deleting file...`, 'warn');
			Filesystem.unlinkSync(candidatePath);
			Logger.makeLog(CLIENT.LOG_PATH, `File "${candidate}" was deleted!`, 'warn');
		} else {
			/// Parse appstate and emit Start Session
			const appstate = JSON.stringify(appState);
			await newSession(appstate, candidatePath, candidate, false).then((data) => {}).catch((err) => {
				Logger.makeLog(CLIENT.LOG_PATH, `${candidate} » Error While Starting New Session`, 'error');
				Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
			});
		}
	}
	
	// Login AppState from Secrets
	if (Credentials.length == 0) {
		if (process.env.MAIN_APPSTATE) {
			await newSession(process.env.MAIN_APPSTATE, '', '<Environment Variable>').then((data) => {}).catch((err) => {
				Logger.makeLog(CLIENT.LOG_PATH, `Main Appstate » Error While Starting New Session`, 'error');
				Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
			});
		} else {
			return Logger.makeLog(CLIENT.LOG_PATH, `There's no credentials in the appstate folder for logins. End of the process :/`, 'warn');
		}
	}
	
	// KEEP THE SERVER BUSY
	setInterval(async () => {
		await Axios.get(CLIENT.SIDE_SERVER_LINK).then((response) => {
			Logger(`Auto Ping » S-Server was running with status: ${response.status}`, '--');
		}).catch((err) => {});
	}, 60 * 1000);
}


async function starter() {
	
	Logger.makeLog(CLIENT.LOG_PATH, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', '--');
	Logger.makeLog(CLIENT.LOG_PATH, `${CLIENT.CONFIG.NAME} »`, '--');
	process.env.IS_SERVICE_RESTARTING = 'false';
	
	await start_server();
	
	try {
		const cache = Filesystem.readdirSync(CLIENT.CACHE_PATH).filter((file) => ['json', 'png', 'mp4', 'mp3', 'jpg', 'txt'].includes((file.split('.')).pop()));
		cache.forEach((file) => {
			try {
				Filesystem.unlinkSync(Path.join(CLIENT.CACHE_PATH, file));
			} catch (e) {};
		});
	} catch (_err) {
		console.error(_err);
	}
	
	// LOAD MODULES
	const modulesFolder = Filesystem.readdirSync(Path.join(CLIENT.ROOT_PATH, 'modules'));
	CLIENT.MODULES = await modules.load(modulesFolder, CLIENT);
	
	// Watch any changes from modules and reload
	watchAndReloadConfig(
		[ CLIENT.MODULES_PATH, CLIENT.CONFIG_PATH ], 'change',
		{ 
			ignored: /^(\.|_|cache).*$/,
			ignoreInitial: true
		},
		async function (path) {
			
			if (path.includes(CLIENT.MODULES_PATH)) {
				Logger.makeLog(CLIENT.LOG_PATH, `Module Changed Detected, Reloading Modules...`, 'module');
				try {
					CLIENT.MODULES = await modules.load(modulesFolder, CLIENT);
				} catch (err) {
					Logger.makeLog(CLIENT.LOG_PATH, `Error detected while reloading modules`, 'module');
					Logger.makeLog(CLIENT.LOG_PATH, err, 'module');
				}
			} else if (path.includes(CLIENT.CONFIG_PATH)) {
				Logger.makeLog(CLIENT.LOG_PATH, `Bot Configuration Changed Detected, Reloading Configuration...`, 'bot');
				try {
					CLIENT.CONFIG = Filesystem.readJsonSync(CLIENT.CONFIG_PATH);
				} catch (err) {
					Logger.makeLog(CLIENT.LOG_PATH, `Error detected while reloading configuration`, 'bot');
					Logger.makeLog(CLIENT.LOG_PATH, err, 'bot');
				}
			}
			
			// try to apply changes on each Agent
			await Object.keys(CLIENT.AGENTS).forEach((bot_id) => {
				const agent = CLIENT.AGENTS[bot_id];
				if (agent.status == 'active') {
					try {
						agent.process.send({
							message: '-update', CLIENT
						});
					} catch (err) {
						Logger.makeLog(CLIENT.LOG_PATH, `Unable to apply module/config updates for ${agent.name}`, 'module');
					}
				}
			});
		}
	);
	
	await loginAgents();
}

starter();