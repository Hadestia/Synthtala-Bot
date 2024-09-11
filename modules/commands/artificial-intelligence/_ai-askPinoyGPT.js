const Axios = require('axios');

module.exports.run = async function ({ args, event, Message, Utils, Post, Logger, ModuleData, CLIENT }) {
	
	const { threadID, senderID, messageID, messageReply } = event;
	
	let prompt = args.join(' ');
	
	let cookie = null;
	let content = "Hi! How can I help you?";
	if (event.type === 'message_reply' && messageReply.body !== '') {
		/*
		const repliedBody = messageReply.body;
		const lastWord = (repliedBody.match(/chatID\:\s\b([0-9A-Za-z_]+)$/g) || [ false ])[0];
		content = (lastWord) ? repliedBody.replace(lastWord, '') : content;
		chatID = (lastWord) ? (lastWord).replace('chatID: ', '').trim() : chatID;
		*/
	}
	
	let chatID = Utils.randomString(11);
	const data = {
		"botId": "chatbot-4yaap9",
		"customId": null,
		"session": "N/A",
		"chatId": chatID,
		"contextId": 87,
		"messages": [{
			"id": Utils.randomString(11),
			"role": "assistant",
			"content": content,
			"who": "AI: ",
			"timestamp": Date.now() - 100000
		}],
		"newMessage": prompt,
		"newFileId": null,
		"stream": false
	}
	
	const config = {
		withCredentials: true,
		headers: {
			"X-WP-Nonce": "53cd3b2b69",
			"Content-Type": "application/json",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
			"Sec-Ch-Ua": '"Not)A;Brand";v="24", "Chromium";v="116"',
			"Sec-Ch-Ua-Mobile": "?1",
			"Sec-Ch-Ua-Platform": '"Android"',
			"User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
		}
	};
	
	Message.react('thinking');
	
	await Promise.race([
		Axios.post('https://www.pinoygpt.com/wp-json/mwai-ui/v1/chats/submit', data, config),
		new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 20000))
	]).then(async (response) => {
		console.log(response.data, '\n');
		console.log(response.headers['set-cookie']);
		
		const reply = response.data.reply;
		const title = await Utils.fancyFont.get('AI', 1);
		const body = [
			title,
			Utils.textFormat('miscs', 'horizontalLineThin'),
			reply
		];
		Message.reply(
			body.join('\n'),
			async (err) => {
				if (err) {
					return Message.react('error');
				}
				Message.react('success');
				await Post.addUserCooldown();
			}
		);
	}).catch((err) => {
		console.error(err);
		Message.react('error');
		Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
		
		try {
			if (err.message) {
				Message.reply(Utils.textFormat('errors', 'errorMsg', err.message));
			}
		} catch (err) {}
	});
}