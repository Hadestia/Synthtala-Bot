const Filesystem = require('fs-extra');
const Path = require('path');


module.exports = function ({ express, CLIENT, Logger }) {
	
	const Router = express.Router();
	
	return new Promise ((resolve, reject) => {
		try {
			const path = Path.join(CLIENT.ROOT_PATH, '/api/');
			// Collect Routers Files
			const files = Filesystem.readdirSync(path)
				.filter((filename) => !filename.startsWith('_') && !filename.startsWith('.') && filename.endsWith('.js'));
			
			// Try to load Routes //
			for (var filename of files) {
				try {
					const api = require(Path.join(path, filename));
					Router.get(api.name || api.path, api.index);
					Logger.makeLog(CLIENT.LOG_PATH, `Router » ${api.name} was loaded.`, '--');
				} catch (err) {
					Logger.makeLog(CLIENT.LOG_PATH, `Router » Unable to load /${filename} with error ${err}`, 'warn');
				}
			}
			
			resolve(Router);
		} catch (err) {
			reject(err);
			console.error(err);
		}
	});
}