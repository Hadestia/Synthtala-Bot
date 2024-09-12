const express = require('express');
const routes = require('./utilities/loadAPIs.js');

const ejs = require('ejs');
const cors = require('cors');
const helmet = require('helmet');
const getIP = require('ipware')().get_ip;
const rate_limiter = require('express-rate-limit');

const { spawn } = require('child_process');
const Path = require('path');
const Logger = require('./utilities/logger.js');

const logPath = Path.join(__dirname, 'cache', 'Log.txt');

async function startServer() {
	
	// CHECK & MAKE FILE TREEs
	try {
		const fileTree = require('./utilities/fileTree.js');
		const ref_fileTree = require(Path.join(__dirname, 'json', 'ref-FileTree.json')); 
		await fileTree.makeFileTree(ref_fileTree, __dirname);
	} catch (_err) {
		return console.error(_err);
	}
	
	// # CREATE THE SERVER
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
	App.set('port', 1000);
	
	let childServer;
	function spawnChildSever() {
		
		if (!childServer) {
			
			process.env.IS_CLIENT_RESTART = 'false';
			
			childServer = spawn('node', ['startServer.js'], {
				cwd: __dirname,
				stdio: 'inherit',
				shell: true
			});
		
			childServer.on('close', (code) => {
				if (code && code == 2) {
					process.env.IS_CLIENT_RESTART = 'true';
					Logger.makeLog(logPath, 'RESTARTING PROJECT', '--');
					startProject();
				}
			});
			
		} else {
			if (childServer.exit) {
				childServer.exit(0);
			}
			childServer = null;
			spawnChildSever();
		}
	}
	
	// API
	App.get('/restart-service', async (req, res) => {
		
		if (!req.query.authKey) {
			return res.status(400).json({ error: 'Missing authentication key!'});
		}
		
		const authKey = req.query.authKey || '';
		if (authKey !== (process.env.AUTH_KEY || 'dummy-key')) {
			return res.status(401).json({ error: 'Invalid authentication key' });
		} else {
			if (!process.env.IS_CLIENT_RESTART || process.env.IS_CLIENT_RESTART == 'false') {
				spawnChildSever();
				process.env.IS_CLIENT_RESTART = 'true';
				res.status(200).json({ message: 'Server is now restarting' });
			} else {
				return res.status(201).json({ error: 'Client is already restarting' });
			}
		}
		
	});
	
	await App.listen(App.get('port'), async () => {
		spawnChildSever();
	});
	
}

startServer();