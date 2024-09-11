const Axios = require('axios');

module.exports.run = async function ({ event, API, Utils }, time_initiated) {
	
	const { threadID, messageID } = event;
	
	const took_msg = `Took ${Math.abs(time_initiated - Date.now())}ms.`;
	API.sendMessage(
		`${await Utils.fancyFont.get('Pong!', 1)}\n\u231B ${await Utils.fancyFont.get(took_msg, 6)}`,
		threadID,
		() => {},
		messageID
	);
}