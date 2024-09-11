module.exports = async function ({ event, API, Utils }) {
	
	const returns = {};
	
	returns.send = async (form, threadID = event.threadID, messageID = event.messageID, callback) => {
		API.sendMessage(form, threadID, callback, messageID);
	}
	
	returns.reply = async (form, callback) => {
		await API.sendMessage(form, event.threadID, callback, event.messageID);
	}
	
	returns.unsend = async (messageID, callback) => {
		await API.unsendMessage(messageID, callback);
	}
	
	returns.react = async (emoji, messageID = event.messageID, callback) => {
		await Utils.sendReaction(emoji, messageID, callback);
	}
	
	return returns;
}