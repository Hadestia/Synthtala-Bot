const Path = require('path');
const Filesystem = require('fs-extra');
const Util = require('./utils.js');

function error(msg, name) {
	let err = new Error(msg);
	if (name) {
		err.name = name;
	} else {
		err.name = 'AppStateError';
	}
	return err;
}

function filterKeysAppState(appState) {
	return appState.filter(item => ["c_user", "xs", "datr", "fr", "sb", "i_user"].includes(item.key));
}

function returnAndSaveAppstate (id, credentialObj, CLIENT) {
	const path = Path.join(CLIENT.APPSTATE_PATH, `${id}.json`);
	const fcaConfig = CLIENT.CONFIG.FCAOption;
	const userAgent = (credentialObj) ? ((credentialObj.login) ? credentialObj.login.userAgent || fcaConfig.userAgent : fcaConfig.userAgent) : fcaConfig.userAgent;
	Filesystem.writeJsonSync(path, credentialObj, { spaces: '\t' });
	return {
		botID: id,
		userAgent,
		botAppState: JSON.stringify(credentialObj.appstate),
	};
}

async function getAppState(loginCredential, CLIENT) {
	
	const getFbState = require(Path.join(CLIENT.ROOT_PATH, 'utilities', 'getFbstate.js'));
	const { email, password, userAgent, proxy } = loginCredential;
	let appstate, code2FATemp;
	
	try {
		appstate = await getFbState(email.trim(), password.trim(), userAgent, proxy);
	} catch (err) {
		const loginMbasic = require(Path.join(CLIENT.ROOT_PATH, 'utilities', 'loginMbasic.js'));
		appstate = await loginMbasic({
			email,
			pass: password, 
			twoFactorSecretOrCode: code2FATemp,
			userAgent,
			proxy
		});
		
		appState = appState.map(item => {
			item.key = item.name;
			delete item.name;
			return item;
		});
		appState = filterKeysAppState(appState);
	}
	
	return appState;
}

module.exports.parse = function ( credentialObj, path, CLIENT ) {
	
	return new Promise(async(resolve, reject) => {
		
		const varType = typeof(credentialObj);
		if ( varType == 'undefined' || varType !== 'object' ) {
			return reject(error(`expected Object{} but got ${varType}.`));
		}
	
		try {
			if (credentialObj.some(obj => typeof obj !== 'object')) {
				return reject(error(`${path} expect OBJECTS[] but got different value!`));
			}
		} catch (err) {
			return reject(error('this is not a valid JSON!!'));
		}
		
		// If appstate is already provided
		if (credentialObj.appstate) {
			
			let appstate = credentialObj.appstate;
			
			if (appstate.some(i => i.name)) {
				// fix invalid "key" keys
				appstate = appstate.map(i => {
					i.key = i.name;
					delete i.name;
					return i;
				});
			} 

			if (!appstate.some(i => i.key)) {
				// missing "key" key 
				return reject(error('Object.appstate not adhered of required structure!!'));
			}
			
			
			if (path) {
				const appStateFiles = Util.getDirFiles(CLIENT.APPSTATE_PATH);
				const existingAppStateValues = appStateFiles.flatMap((filename) => {
					const filePath = Path.join(CLIENT.APPSTATE_PATH, filename);
					if (filePath !== path) {
						try {
							const fileContent = Filesystem.readFileSync(filePath, 'utf8');
							const fileAppState = JSON.parse(fileContent);
							return fileAppState.appstate;
						} catch (err) {
							//return reject(error(`error parsing JSON in file ${filePath}: ${err}`));
						}
					}
				});
				
				const isDuplicate = appstate.some(newCookie => 
					existingAppStateValues.some(existingCookie => 
						JSON.stringify(newCookie) === JSON.stringify(existingCookie)
					)
				);
	
				if (isDuplicate) {
					return reject(error('Duplicate app state detected'));
				}
			}
			
			const facebook_id = (appstate.find(cookie => cookie.key === 'c_user') || { value: false }).value;
			if (!facebook_id) {
				return reject(error('Cannot find user ID!'));
			}
			
			credentialObj.appstate = appstate;
			const data = returnAndSaveAppstate(facebook_id, credentialObj, CLIENT);
			return resolve(data);
			
		// Login with login credentials
		} else if (credentialObj.login) {
			
			const { email, password } = credentialObj.login;
			
			if (!email || !password) {
				return reject(error('Object.login missing login credentials'));
			}
			
			let appstate = getAppState(credentialObj.login, CLIENT)
			
			if (!appstate) {
				return reject(error('Unable to get appstate from login credential'));
			}
			
			const facebook_id = (appstate.find(cookie => cookie.key === 'c_user') || { value: false }).value;
			if (!facebook_id) {
				return reject(error('Cannot find user ID using login credential'));
			}
			
			credentialObj.appstate = appstate;
			const data = returnAndSaveAppstate(facebook_id, credentialObj, CLIENT);
			return resolve(data);
			
		} else {
			return reject(error('Object not adhered of required structure'));
		}
	});
}