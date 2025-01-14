module.exports = function ({ GLOBAL, BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const Handler = {};
	
	Handler.dictionary = {};
	
	Handler.addReplyInfo = function ( data ) {
		Handler.dictionary[data.messageID] = data;
	}
	
	Handler.deleteReplyInfo = function ( messageID = '' ) {
		if (Handler.dictionary[messageID]) {
			delete Handler.dictionary[messageID];
		}
	}
	
	Handler.listen = async function ({ event, API, GLOBAL, MODULES, Message }) {
		
		if (event.type !== 'message_reply') return;
		
		const { messageID, senderID, threadID, messageReply } = event;
		
		if (!messageReply) return;
		
		// console.dir('messageReply:', messageReply);
		const groupData = await Threads.getData(threadID);
		const groupSettings = (groupData) ? groupData.settings : {};
			
		const prefix_used = groupSettings['bot-prefix'] || GLOBAL.CLIENT.CONFIG.defaultPrefix;
		const replied_messageID = messageReply.messageID;

		if (Handler.dictionary[replied_messageID]) {
				
			const replyInfo = Handler.dictionary[replied_messageID];
					
			// console.dir(replyInfo);
			const command_obj = MODULES.commands[replyInfo.commandID];
			
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Command-Reply ${replyInfo.commandID} was called by user-${senderID} from thread-${threadID}.`, 'module');
			// does not belong to the current sender? | Owner/Admin can interact as well
			const isBotAdmin = GLOBAL.CLIENT.CONFIG.botAdmins.includes(senderID);
			const isBotOwner = GLOBAL.CLIENT.CONFIG.botOwners.includes(senderID);
			
			if (replyInfo.senderID !== senderID) {
				if (!isBotOwner || !isBotAdmin) {
					Message.reply(Utils.textFormat('errors', 'warningMsg', 'You cannot interact on request by others.'), Utils.autoUnsend);
					return;
				}
			}
				
			if (!command_obj) {
				Message.reply(Utils.textFormat('errors', 'errorMsg', 'Err: <unfound command event>'), Utils.autoUnsend);
				return;
			}
				
			if (replyInfo.expiration < Date.now()) {
				Message.reply(Utils.textFormat('errors', 'errorMsg', 'Interaction timeout.'), Utils.autoUnsend);
				API.unsendMessage(replied_messageID, (e) => {});
				Handler.deleteReplyInfo(replied_messageID);
				return;
			}
					
			const moduleData = command_obj.moduleData;
			const commandData  = await Commands.getData( moduleData.id ) || { ID: moduleData.id, data: moduleData, cooldowns: {} };
				
			const Post = {}
			Post.deleteReplyInfo = function ( messageID = replied_messageID ){
				API.unsendMessage(messageID, (e) => {});
				Handler.deleteReplyInfo(messageID);
			};
				
			Post.addUserCooldown = async function () {
				if ((moduleData.cooldown || 0) !== 0 && !isBotOwner) {
					commandData.cooldowns[senderID] = Date.now();
					await Commands.setData(moduleData.id, commandData ).then((obj) => {
						console.log(`Command ${moduleData.id} ${obj.signal} Data For User-${senderID}.`);
					}).catch(console.error);
				}
			}
			Post.invalid_reply_usage = function () {
				Message.reply(
					Utils.textFormat('commands', 'cmdInvalidReplySyntax', command_obj.moduleData.replyUsage || ''),
					Utils.autoUnsend,
				);
			}
			// Cache Inputs
			const Inputs = { event, API, GLOBAL, BOT_INFO, Utils, Message, Bans, Users, Threads, Commands, Logger };
			Inputs.ModuleData = command_obj.moduleData;
			Inputs.Post = Post;
			Inputs.replyInfo = replyInfo;
			Inputs.prefixUsed = prefix_used;

			const moduleScript = require(command_obj.moduleScriptPath);

			try {
				if (moduleScript.handleReply && typeof(moduleScript.handleReply) === 'function') {
					if (moduleScript.handleReply.constructor.name === 'AsyncFunction') {
						await moduleScript.handleReply(Inputs);
					} else {
						moduleScript.handleReply(Inputs);
					}
				}
			} catch (err) {
				Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Command-Reply ${replyInfo.commandID} ERROR: ${err}.`, 'error');
				console.error(err);
			}
		}
	}
	return Handler;
}