const Axios = require('axios');

module.exports.run = async function ({ args, event, Message, Utils, Post, Logger, ModuleData, CLIENT }) {
	
	const { threadID, messageID, messageReply } = event;
	
	let prompt = args.join(' ');
	
	if (event.type === 'message_reply' && messageReply.body !== '') {
		prompt = `"${messageReply.body}", ${args.join(' ')}`;
	}

	// const id = `${Utils.randomString(10)}-${Utils.randomString(10)}`;
	const headers = {
		"Cookie": "sessionId=23b46170-6685-456c-b30b-d28b0b2d3706; personalId=23b46170-6685-456c-b30b-d28b0b2d3706; intercom-id-jlmqxicb=7d9286e0-f4a2-4dab-8739-aa264d6f733e; intercom-device-id-jlmqxicb=e893eb1b-1077-4a3a-8e27-0d9d1e949dae; intercom-session-jlmqxicb=",
		"Content-Type": "application/json",
		"Origin": "https://www.blackbox.ia",
		"Referer": "https://www.blackbox.ia/agent/IanYQ3mknU",
		"User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
	};
	const config = {
		"messages":[{
			"id": "SVNaDhsdI_FlPHGFGlDyB","content": `${prompt}`,"role": "user"
		}],
		"id": "SVNaDhsdI_FlPHGFGlDyB",
		"previewToken": null,
		"userId": null,
		"codeModelMode": true,
		"agentMode":{
			"mode": true,"id": "IanYQ3mknU","name": "Ian"
		},
		"trendingAgentMode": {},
		"isMicMode": false,
		"maxTokens": 1024,
		"isChromeExt": false,
		"githubToken": null,
		"clickedAnswer2": false,
		"clickedAnswer3": false,
		"clickedForceWebSearch": false,
		"visitFromDelta": false,
		"mobileClient": false,
		"withCredentials": true
	};
	
	
	Message.react('thinking');
	
	await Promise.race([
		Axios.post('https://www.blackbox.ai/api/chat', config, headers),
		new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout for prompt: "${prompt}"`), 600000))
	]).then(async (response) => {
		
		// format bold text
		let ai_response = (response.data).replace(/^\$@\$.*?\$@\$/g, '');
		let supposedlyBold = ai_response.match(/\*\*.*?\*\*/g) || [];
		console.log(supposedlyBold);
		
		const title = await Utils.fancyFont.get('BlackboxAI', 1);
		
		Message.reply(
			Utils.textFormat('formats', 'headerNContentThinFormat', `\uD83D\uDCAC ${title}`, ai_response.replace(/\*\*/g, '')),
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
	});
}