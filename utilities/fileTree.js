// FileTree : Will automatically make default folders and subfolders if not existed.
const { existsSync } = require('fs-extra');
const { exec } = require('child_process');

async function makeFileTree (obj, basePath) {
	Object.keys(obj).forEach(function(key) {
		let path = basePath + '/' + key;
		if (!existsSync(path)) {
			exec(`mkdir ${path}`, (error, stdout, stderr) => {
				if (error) {
					throw new Error(`exec error: ${error}`);
				}
				if (stderr) {
					throw new Error(`exec stderr: ${stderr}`);
				}
				// If the property is a sub-object, create a directory for it recursively
				if (typeof obj[key] === 'object') {
					makeFileTree(obj[key], path);
				}
			});
		}
	});
}

module.exports.makeFileTree = makeFileTree;