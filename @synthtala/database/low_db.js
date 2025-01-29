const Path = require('path');

module.exports = async function (inputs) {
	
	const { GLOBAL } = inputs;
	const promise = new Promise(async (resolve, reject) => {
		// Fetch Controllers
		const controllerPath = Path.join(GLOBAL.CLIENT.DATA_PATH, 'database', 'controllers');
		
		/*
		const Bans = await require(Path.join(controllerPath, 'controller_bans.js'))(inputs);
		const Users = await require(Path.join(controllerPath, 'controller_users.js'))(inputs);
		const Threads = await require(Path.join(controllerPath, 'controller_threads.js'))(inputs);
		const Commands = await require(Path.join(controllerPath, 'controller_commands.js'))(inputs);
		
		try {
			
			await Bans.init();
			await Users.init();
			await Threads.init();
			await Commands.init();
			
			resolve({ Bans, Users, Threads, Commands });
			
		} catch (err) {
			
			reject(err);
			
		}
		*/
		
		resolve();
	});
	
	return promise;
}