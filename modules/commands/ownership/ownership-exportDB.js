const Filesystem = require('fs-extra');
const Path = require('path');

module.exports.run = async function ({ args, event, CLIENT, Message, Utils, Post, Logger, Bans, Users, Threads, Commands }) {
	
	const { threadID, senderID } = event;
	
	// Arg Format: /export [type] [uid/*]
	
	let type = args[0].toLowerCase();
	let targetID = args[1];
	let data;
	
	function replyNoData() {
		Message.reply(Utils.textFormat('errors', 'errorMsg', `No data found for ID: ${targetID}`));
	}
	
	async function sendFile(filename, data) {
		const path = Path.join(CLIENT.CACHE_PATH, `${filename}.json`);
		await Filesystem.writeJsonSync(path, data, { spaces: '\t' });
		Message.reply(
			{
				body: Utils.textFormat('formats', 'successMsg', 'Here\'s the requested file, click the attachment to download.'),
				attachment: Filesystem.createReadStream(path)
			},
			(err) => {
				Filesystem.unlinkSync(path);
				if (err) {
					Message.react('error');
				}
			}
		);
	}
	
	switch (type) {
		case 'user':
			data = await Users.getData(targetID);
			if (data) {
				await sendFile(`user-${targetID}`, data);
			} else {
				replyNoData();
			}
			break;
			
		case 'group':
			data = await Threads.getData(targetID);
			if (data) {
				await sendFile(`group-${targetID}`, data);
			} else {
				replyNoData();
			}
			break;
			
		case 'ban':
			data = await Bans.getData(targetID);
			if (data) {
				await sendFile(`ban-${targetID}`, data);
			} else {
				replyNoData();
			}
			break;
			
		case 'command':
			data = await Commands.getData(targetID);
			if (data) {
				await sendFile(`command-${targetID}`, data);
			} else {
				replyNoData();
			}
			break;
		default:
			Post.invalidSyntax(Utils.textFormat('errors', 'errorMsg', `No data found for type: ${type}`));
			break;
	}
}