module.exports = function ({ GLOBAL, BOT_INFO, Message, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const Handler = {};
	
	Handler.dictionary = {};
	
	Handler.addReactionInfo = async function ( data ) {
		Handler.dictionary[data.messageID] = data;
	}
	
	Handler.deleteReactionInfo = function ( messageID = '') {
		if (Handler.dictionary[messageID]) {
			delete Handler.dictionary[messageID];
		}
	}
	
	Handler.listen = async function ({ event, API, GLOBAL, MODULES, Message }) {
		
		if (event.type !== 'message_reaction') return;
		
		const { messageID, senderID, threadID, userID } = event;
			
		if (Handler.dictionary[messageID]) {
			
			const reactionInfo = Handler.dictionary[messageID];
				
			const command_obj = MODULES.commands[reactionInfo.commandID];
			
			Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Command-Reaction ${reactionInfo.commandID} was called by user-${senderID} from thread-${threadID}.`, 'module');

			// delete reply info function
			const deleteReactionInfo = async function ( index ) {
				API.unsendMessage(messageID, (e) => {});
				Handler.deleteReplyInfo(messageID);
			}
					
			// does not belong to the current sender? | Owner/Admin can interact as well
			const isBotAdmin = GLOBAL.CLIENT.CONFIG.botAdmins.includes(userID);
			const isBotOwner = GLOBAL.CLIENT.CONFIG.botOwners.includes(userID);
			const userName = await Users.getNameUser(userID);

			if (reactionInfo.userID !== userID) {
				if (!isBotOwner || !isBotAdmin) {
					return Message.reply(
						{
							body: Utils.textFormat('errors', 'warningMsg', `@${userName} You cannot interact on request by others.`),
							mentions: [{ tag: `@${userName}`, id: userID }]
						},
						Utils.autoUnsend
					);
				}
			}
				
			if (reactionInfo.expiration < Date.now()) {
				Message.reply(
					{
						body: Utils.textFormat('errors', 'errorMsg', 'Interaction timeout.'),
						mentions: [{ tag: userName, id: userID }]
					},
					Utils.autoUnsend
				);
				deleteReactionInfo();
				return;
			}
				
			const Post = {}
			Post.deleteReactionInfo = deleteReactionInfo;
				
			/// Prepare to execute command
			const Inputs = { event, API, GLOBAL, BOT_INFO, Utils, Message, Post, Bans, Users, Threads, Commands, Logger };
			Inputs.ModuleData = command_obj.moduleData;
			Inputs.reactionInfo = reactionInfo;
			
			const moduleScript = require(command_obj.moduleScriptPath);
				
			try {
				if (moduleScript.handleReaction && typeof(moduleScript.handleReaction) === 'function') {
					if (moduleScript.handleReaction.constructor.name === 'AsyncFunction') {
						await moduleScript.handleReaction(Inputs);
					} else {
						moduleScript.handleReaction(Inputs);
					}
				}
			} catch (err) {
				Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Command-Reaction ${reactionInfo.commandID} ERROR: ${err}`, 'error');
				console.error(err);
			}
		}
	}
	
	return Handler;
}