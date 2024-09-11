module.exports = function (input) {
	
	return new Promise ((resolved, reject) => {
		try {
			const force = false;
			
			const Bans = require('./models/model_bans.js')(input);
			const Users = require('./models/model_users.js')(input);
			const Threads = require('./models/model_threads.js')(input);
			const Commands = require('./models/model_commands.js')(input);
			
			Bans.sync({ force });
			Users.sync({ force });
			Threads.sync({ force });
			Commands.sync({ force });
			
			resolved({
				model: {
					Bans,
					Users,
					Threads,
					Commands
				},
				use: function (modelName) {
					return this.model[`${modelName}`];
				}
			});
		} catch (error) {
			reject(error);
		}
	});
}