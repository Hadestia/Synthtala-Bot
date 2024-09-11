module.exports.handleEvent = async function ({ event, API, BOT_INFO, Utils, ModuleData }) {
	
	const body = event.body.toLowerCase();
	
	switch (event.type) {
		case 'message_reply':
			if (![ ...ModuleData.aliases, ModuleData.name ].includes(body)) {
				break;
			}
			const eligible = await Utils.hasPermission(event, ModuleData.permission);
			if (eligible) {
				this.run({ event, API, BOT_INFO, Utils, ModuleData });
			}
			break;
		case 'message_reaction':
			if (event.reaction === ModuleData.placeholders.expectedReaction && event.senderID === BOT_INFO.ID) {
				const eligible = await Utils.hasPermission(event, ModuleData.permission);
				if (eligible) {
					API.unsendMessage(event.messageID, () => {});
				}
			}
			break;
		default:
			break;
	}
	return;
}

module.exports.run = function({ event, API, BOT_INFO, Utils, ModuleData }) {
	
	// if not reply
	if (event.type !== 'message_reply') {
		Utils.sendReaction('error', event.messageID);
		return API.sendMessage(Utils.textFormat('errors', 'errorMsg', 'You should reply to the target message.'), event.threadID, event.messageID);
	} else {
	
		if (event.messageReply.senderID !== BOT_INFO.ID) {
			Utils.sendReaction('error', event.messageID);
			return API.sendMessage(Utils.textFormat('errors', 'errorMsg', 'That was not my message.'), event.threadID, event.messageID);
		}
	
		Utils.sendReaction('success', event.messageID);
		return API.unsendMessage(event.messageReply.messageID, () => {});
	}
}