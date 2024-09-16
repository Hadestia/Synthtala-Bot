const Path = require('path');
const Filesystem = require('fs-extra');
const Util = require('./utils.js');

function error(msg) {
	return `Invalid AppState: ${msg}`;
}

module.exports.parse = function ( stringifyAppstate, fromFolder, CLIENT ) {
	
	const promise = new Promise((resolve, reject) => {
		
		const varType = typeof(stringifyAppstate);
		if ( varType == 'undefined' || varType !== 'string' ) {
			return reject(error('expected string but got null or other datatypes'));
		}
	
		if (stringifyAppstate === '') {
			return reject(error('expected string of OBJECTS[] but got NULL!!'));
		}
	
		let appStateData;
	
		try {
    		appStateData = JSON.parse(stringifyAppstate.replace(/\\/g, ''));
			if (!Array.isArray(appStateData) || appStateData.some(obj => typeof obj !== 'object')) {
				return reject(error('expected array of OBJECTS[] but got different value!!'));
			}
		} catch (err) {
			return reject(error('this is not a valid JSON!!'));
		}
	
		const requiredKeys = ['key', 'value', 'domain', 'path', 'hostOnly', 'creation', 'lastAccessed'];
		const isValidAppState = appStateData.every(state =>
			requiredKeys.every(key => Object.prototype.hasOwnProperty.call(state, key))
		);
	
		if (!isValidAppState) {
			return reject(error('not adhered of required structure!!'));
		}
	
		const appStateFiles = Util.getDirFiles(CLIENT.APPSTATE_PATH);
		const existingAppStateValues = appStateFiles.flatMap((filename) => {
			const filePath = Path.join(CLIENT.APPSTATE_PATH, filename);
			try {
				const fileContent = Filesystem.readFileSync(filePath, 'utf8');
				const fileAppState = JSON.parse(fileContent);
				return fileAppState;
			} catch (err) {
				return reject(error(`error parsing JSON in file ${filePath}: ${err}`));
			}
		});
		
		if (!fromFolder) {
			const isDuplicate = appStateData.some(newCookie => 
				existingAppStateValues.some(existingCookie => 
					JSON.stringify(newCookie) === JSON.stringify(existingCookie)
				)
			);
	
			if (isDuplicate) {
				return reject(error('duplicate appstate detected!!'));
			}
		}
	
		const fbUID = (appStateData.find(cookie => cookie.key === 'c_user') || { value: false }).value;
		if (!fbUID) {
			return reject(error('cannot find user ID!'));
		}
		return resolve({ botID: fbUID, botAppState: stringifyAppstate });
	});
	
	return promise;
	
}

module.exports.create_override = function ( stringifyAppstate, CLIENT) {
	
	const appStateData = JSON.parse(stringifyAppstate.replace(/\\/g, ''));
	const id = (appStateData.find(cookie => cookie.key === 'c_user')).value;
	const path = Path.join(CLIENT.APPSTATE_PATH, `${id}.json`);
	
	Filesystem.writeFileSync(path, JSON.stringify(appStateData, null, 4), 'utf8');
	
	return (Filesystem.existsSync(path)) ? true : false;
}