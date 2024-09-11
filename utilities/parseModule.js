const Axios = require('axios');
const Util = require('./utils.js');
const Filesystem = require('fs-extra');
const Logger = require('./logger.js');
const Path = require('path');


// Check if object meets the standard content of a Module
function checkModuleMaturity(fileName, object, type) {
	
	const objType = type == 1 ? 'Command' : 'Event';
	
	// 0 - Both // this key can be check for both types
	// 1 - Commands // check only for command type
	// 2 - Events // only for event type
	const criteria = {
		id: { rule: 0, type: 'string' },
		script: { rule: 0, type: 'string' },
		
		aliases: { rule: 1, type: 'object', next: 'isArray', optional: true },
		requiredArgument: { rule: 1, type: 'number' },
		permission: { rule: 1, type: 'number' },
		category: { rule: 1, type: 'string' },
		usage: { rule: 1, type: 'string' },
		name: { rule: 1, type: 'string' },
		
		eventType: { rule: 2, type: 'object', next: 'isArray' }
	}
	
	let error = '';
	let success = true;
	
	//console.dir(object);
	
	for (const key in criteria) {
		const value = criteria[key];
		if (value.rule == 0 || value.rule == type) {
			
			if (value.optional) {
				if (key in object) {
					const dataType = typeof(object[key]);
					if (dataType !== value.type) {
						if (value.next) {
							if (value.next == 'isArray' && !Array.isArray(object[key])) {
								error += `MODULE:\n${fileName} for KEY:${key} expect "${array}" but got "${object}"!!\n`;
							} 
						} else {
							error += `MODULE:\n${fileName} for KEY:${key} expect "${value.type}" but got "${dataType}"!!\n`;
						}
						success = false;
					}
				}
			} else {
				if (!key in object) {
					error += `MODULE:\n${fileName} unable to find KEY:${key} for type ${objType}!!\n`;
					success = false;
				}
				
				const dataType = typeof(object[key]);
				if (dataType !== value.type) {
					error += `MODULE:\n${fileName} for KEY:${key} expect "${value.type}" but got "${dataType}"!!\n`;
					success = false;
				} else {
					if (value.next) {
						if (value.next == 'isArray' && !Array.isArray(object[key])) {
							error += `MODULE:\n${fileName} for KEY:${key} expect "${array}" but got "${object}"!!\n`;
						} 
					}
				}
			}
		}
	}
	
	return { error, success };
}

function isValidScript(script) {
	return script.run ? true : false;
}

// check if string was a valid URL
function isValidURL(string) {
	var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
		'((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
		'(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
		'(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator

	return !!urlPattern.test(string);
}

function getFileName(url) {
	return url.substring(url.lastIndexOf('/')+1);
}

module.exports = async function (object, fileName, path, folderPath) {

	let errorMessages = ''
	const returnable = { error: '', moduleData: object };
	
	if (typeof(object) !== 'object') {
		errorMessages += `MODULE:\n${fileName} WAS NOT A BOT MODULE!!\n`;
		returnable.error = errorMessages;
		return returnable;
	}
	
	if (!object.type) {
		errorMessages += `MODULE:\n${fileName} CANNOT IDENTIFY WITHOUT "type" ATTRIBUTE!!`;
		returnable.error = errorMessages;
		return returnable;
	}
	
	const type = object.type.trim().toLowerCase();
	
	//// TYPE: COMMANDS ////////////////////////////////////////////////
	if (type == 'commands' || type == 'command') {
		
		object.type = 'command';
		
		// This will return an error if module is not matured
		const { error, success } = checkModuleMaturity(fileName, object, 1);
		
		if (!success) {
			errorMessages += error;
			returnable.error = errorMessages;
			return returnable;
		}
		
		// Check if script was a CDN script
		/* if (isValidURL(object.script) && !fileExist) {
			const scriptFileName = getFileName(object.script);
			moduleScriptPath = Path.join(path, scriptFileName);
			if (!Filesystem.existsSync(moduleScriptPath)) {
				await Util.downloadFile(object.script, folderPath).then(() => {
					
					Logger.makeLog(global.NASMERAH_BOT.LOG_PATH, `${fileName} Draft(${object.id}) script was downloaded successfully with path(${moduleScriptPath}).`);
					
				}).catch((error) => {
					
					errorMessages = `${fileName} Draft(${object.id}): Unable to download script from link (${object.script}). Rejecting process with error:\n ${error}\n`;
					Logger.makeLog(global.NASMERAH_BOT.LOG_PATH, errorMessages);
					
				});
				
				if (errorMessages !== '') {
					returnable.error = errorMessages;
					return returnable;
				}
			}
		} */
		
	//// TYPE: EVENTS ////////////////////////////////////////////////
	} else if (type == 'events' || type == 'event') {
		
		object.type = 'event';
		
		// This will return an error if module is not matured
		const { error, success } = checkModuleMaturity(fileName, object, 2);
		
		if (!success) {
			errorMessages += error;
			returnable.error = errorMessages;
			return returnable;
		}
		
		// Check if script was a CDN script
		/* if (isValidURL(object.script) && !fileExist) {
			const scriptFileName = getFileName(object.script);
			moduleScriptPath = Path.join(path, scriptFileName);
			if (!Filesystem.existsSync(moduleScriptPath)) {
				await Util.downloadFile(object.script, folderPath).then(() => {
					
					Logger.makeLog(global.NASMERAH_BOT.LOG_PATH, `${fileName} Draft(${object.id}) script was downloaded successfully with path(${scriptPath}).`);
					
				}).catch((error) => {
					
					errorMessages = `${fileName} Draft(${object.id}): Unable to download script from link (${object.script}). Rejecting process with error:\n ${error}\n`;
					Logger.makeLog(global.NASMERAH_BOT.LOG_PATH, errorMessages);
					
				});
				
				if (errorMessages !== '') {
					returnable.error = errorMessages;
					return returnable;
				}
			}
		} */
		
		
	} else {
		errorMessages += `MODULE:\n${fileName} IS UNABLE TO IDENTIFY WITH A TYPE:${type}\n`;
		returnable.error = errorMessages;
		return returnable;
	}
	
	let moduleScriptPath;
	const sampleScriptPath = Path.join(folderPath, object.script);
	const fileExist = Filesystem.existsSync(sampleScriptPath);
	moduleScriptPath = (fileExist) ? sampleScriptPath : object.script;
	
	if (!fileExist) {
		errorMessages += `${fileName} Draft(${object.id}) Unable to find script ${object.script}!`;
		Logger.makeLog(global.NASMERAH_BOT.LOG_PATH, errorMessages);
		returnable.error = errorMessages;
		return returnable;
	}
	
	
	/// Try to fetch script
	try {
		const draftScript = require(moduleScriptPath);
		
		if (isValidScript(draftScript)) {
			returnable.error = (errorMessages === '' ? false : errorMessages);
			returnable.moduleScriptPath = moduleScriptPath;
			return returnable;
			
		} else {
			const error = `Attempted to load script: ${moduleScriptPath} but no 'run()' function found!!!`;
			returnable.error = error;
			return returnable;
		}
	} catch (error) {
		returnable.error = error;
		return returnable;
	}
}