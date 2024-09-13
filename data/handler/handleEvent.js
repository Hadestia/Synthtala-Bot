const Filesystem = require('fs-extra');
const Path = require('path');

module.exports = function ({ BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const Handler = {};
	
	Handler.listen = async function ({ event, API, CLIENT, MODULES, HandleDatebase, Message }) {
		
		if (event.type !== 'event') return;
		
		for (const evt_id in MODULES.events) {
			
			const event_obj = MODULES.events[evt_id];
			const moduleData = event_obj.moduleData;
				
			/// Prepare to execute command
			const Inputs = { event, API, CLIENT, BOT_INFO, Utils, Message, Bans, Users, Threads, Commands, Logger, HandleDatebase };
			Inputs.ModuleData = moduleData;
				
			try {
				const matchedEventType = (moduleData.eventType.indexOf(event.logMessageType) !== -1) ? true : false;
				if (matchedEventType) {
					const moduleScript = require(event_obj.moduleScriptPath);
					if (moduleScript.run && typeof(moduleScript.run) === 'function') {
						if (moduleScript.run.constructor.name === 'AsyncFunction') {
							await moduleScript.run(Inputs);
						} else {
							moduleScript.run(Inputs);
						}
					}
				}
			} catch (e_error) {
				console.error(e_error);
			}
		}
	}
	
	return Handler;
	
}