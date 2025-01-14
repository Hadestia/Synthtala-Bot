module.exports = function ({ BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const Handler = {};
	
	Handler.listen = async function ({ event, API, GLOBAL, MODULES, HandleDatebase, Message }) {
		
		if (event.type !== 'event') return;
		
		// Cache Inputs
		const Inputs = { event, API, GLOBAL, BOT_INFO, Utils, Message, Bans, Users, Threads, Commands, Logger, HandleDatebase };
		
		for (const evt_id in MODULES.events) {
			
			const event_obj = MODULES.events[evt_id];
			const moduleData = event_obj.moduleData;
			// Update Inputs
			Inputs.ModuleData = moduleData;
				
			const matchedEventType = (moduleData.eventType.indexOf(event.logMessageType) !== -1) ? true : false;
			
			if (matchedEventType) {
				Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Event ${evt_id} was called at thread-${event.threadID}.`, 'module');
				const moduleScript = require(event_obj.moduleScriptPath);
				try {
					if (moduleScript.run && typeof(moduleScript.run) === 'function') {
						if (moduleScript.run.constructor.name === 'AsyncFunction') {
							await moduleScript.run(Inputs);
						} else {
							moduleScript.run(Inputs);
						}
					}
				} catch (err) {
					Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Event ${evt_id} ERROR: ${err}.`, 'error');
					console.error(err);
				}
			}
		}
	}
	
	return Handler;
	
}