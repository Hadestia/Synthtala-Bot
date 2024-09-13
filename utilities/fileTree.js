// FileTree : Will automatically make default folders and subfolders if not existed.
const { existsSync } = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');

async function makeFileTree (obj, basePath, CLIENT, Logger) {
	Object.keys(obj).forEach(function(key) {
		let path = path.normalize(basePath + '/' + key);
		if (!existsSync(path)) {
			exec(`mkdir ${path}`, (error, stdout, stderr) => {
				if (error) {
					throw new Error(`exec error: ${error}`);
				}
				if (stderr) {
					throw new Error(`exec stderr: ${stderr}`);
				}
				
				Logger.makeLog(CLIENT.LOG_PATH, `File/Directory "${key}" was created`, '--');
				// If the property is a sub-object, create a directory for it recursively
				if (typeof obj[key] === 'object') {
					makeFileTree(obj[key], path, CLIENT, Logger);
				}
			});
		}
	});
}

module.exports.makeFileTree = makeFileTree;