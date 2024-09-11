module.exports.run = async function ({ args, event, API, Utils }) {
	
	const { threadID, messageID } = event;
	
	const type = args.shift();
	
	let message;
	if (event.type === 'message_reply') {
		message = event.messageReply.body;
	} else {
		message = args.join(' ');
	}
	
	if (!parseInt(type) || parseInt(type) > 6 || parseInt(type) < 1) {
		return API.sendMessage(
			Utils.textFormat('errors', 'errorMsg', 'Invalid font number, must be a number from 1 - 6'),
			threadID,
			Utils.autoUnsend,
			messageID
		);
	}
	
	const types = [
		'bold-sans',
		'bold-sans-italic',
		'bold-serif',
		'bold-serif-italic',
		'bold-medieval',
		'thin-font1'
	]
	
	const result = await Utils.fancyFont.get(message, types[type - 1]);
	API.sendMessage(result, threadID, messageID);
	return Utils.sendReaction('success', messageID);
}