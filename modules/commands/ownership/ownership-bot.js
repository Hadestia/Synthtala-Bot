module.exports.run = async function ({ args, event, API, CLIENT, Utils }) {
	
	const Axios = require('axios');
	const { threadID, messageID } = event;
	const option = (args.shift()).toLowerCase();
	
	const sendMsg = (msg, success = true) => {
		API.sendMessage(Utils.textFormat(((success) ? 'formats' : 'errors'), ((success) ? 'successMsg' : 'errorMsg'), msg), threadID, () => {}, messageID);
	};
	
	switch (option) {
		case '-list':
			await Axios.get(`${CLIENT.SERVER_LINK}/running-bot`).then(async(response) => {
				
				const list = response.data; // Object{} 
				let list_body = '';
				
				for (const id in list) {
					const content = list[id];
					list_body += `${Utils.textFormat('formats', 'greaterthanResult', content.name)}\n`;
				}
				
				const title = await Utils.fancyFont.get('Active Bot', 1);
				const body = [
					title,
					Utils.textFormat('miscs', 'horizontalLineThin'),
					'',
					list_body
				];
				
				API.sendMessage(
					(body.join('\n')),
					threadID,
					() => {},
					messageID
				);
			}).catch((err) => {
				console.error(err);
				Utils.sendReaction('error', messageID);
			});
			break;
		case '-help-decor':
			if (args.length === 0) {
				sendMsg(`Invalid parameter[s], Expected: 'gif'/'img'/'none' but got nothing.`, false);
			} else {
				const type = (args.shift()).toLowerCase();
				if (['gif', 'img', 'none'].includes(type)) {
					CLIENT.CONFIG.helpCommandDecor = type;
					Utils.saveBotConfig(CLIENT.CONFIG);
					sendMsg(`decoration was set to '${type}'.`);
				} else {
					sendMsg(`Invalid parameter[s], Expected: 'gif'/'img'/'none' but got ${type}.`, false);
				}
			}
			break;
		default:
			break;
	}
}