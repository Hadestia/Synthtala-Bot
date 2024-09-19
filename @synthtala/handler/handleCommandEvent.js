const Filesystem = require('fs-extra');

module.exports = function ({ CLIENT, BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const databaseReference = Filesystem.readJsonSync(`${CLIENT.ROOT_PATH}/json/ref-defaultDatabase.json`);

	const Handler = {};
	
	Handler.listen = async function ({ event, API, CLIENT, MODULES, Message, HandleCommandReply, CharacterAI }) {
		
		let { body, mentions, senderID, threadID, messageReply, isGroup } = event;
		
		const GroupData = await Threads.getData(threadID);
		
		let groupSettings = (GroupData) ? GroupData.settings : databaseReference.group_db.settings;

		const bot_mention_prefix = (mentions && Object.keys(mentions).length > 0 && Object.keys(mentions)[0] == BOT_INFO.ID) ? true : false;
		const bot_was_mentioned_name = (bot_mention_prefix) ? (Object.values(mentions)[0]).replace('@', '') : BOT_INFO.ID;
		const prefix_used = (groupSettings.hasOwnProperty('bot-prefix')) ? groupSettings['bot-prefix'] : CLIENT.CONFIG.defaultPrefix;
		//const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(prefix_used)})\\s*`);
		const prefixRegex = new RegExp(`^(<@!?${senderID}>|\@${bot_was_mentioned_name}|${escapeRegex(prefix_used)})\\s*`);
			
		// @Command Request Message
		if (prefixRegex.test(body)) return;
		// @Command Reply Message
		if (event.type === 'message_reply' && messageReply) {
			if (HandleCommandReply.dictionary[messageReply.messageID]) return;
		}
		// Cache Inputs
		const Inputs = { event, API, CLIENT, BOT_INFO, Utils, Message, Bans, Users, Threads, Commands, Logger };
			
		for (const cmd_id in MODULES.commands) {
			
			const command_obj = MODULES.commands[cmd_id];
			const moduleData = command_obj.moduleData;
				
			// Loop through defined types
			if (moduleData.handleEvent) { // @Type Array[]
				for (const definedType of moduleData.handleEvent) {
					if (event.type === definedType) {
						// Update Inputs
						Inputs.ModuleData = moduleData;
						Inputs.CharacterAI = CharacterAI;
						Inputs.HandleCommandReply = HandleCommandReply;
					
						const moduleScript = require(command_obj.moduleScriptPath);
					
						try {
							if (moduleScript.handleEvent && typeof(moduleScript.handleEvent) === 'function') {
								Logger.makeLog(CLIENT.LOG_PATH, `Command-Event ${cmd_id} was called at thread-${threadID}.`, 'module');
								if (moduleScript.handleEvent.constructor.name === 'AsyncFunction') {
									await moduleScript.handleEvent(Inputs);
								} else {
									moduleScript.handleEvent(Inputs);
								}
							}
						} catch (err) {
							Logger.makeLog(CLIENT.LOG_PATH, `Command-Event ${cmd_id} ERROR: ${err}`, 'error');
							console.error(err);
						}
					}
				}
			}
		}
	}
	
	return Handler;
}