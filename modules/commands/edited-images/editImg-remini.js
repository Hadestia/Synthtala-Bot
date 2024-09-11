const Filesystem = require('fs-extra');
const Axios = require('axios');

module.exports.run = async function({ event, args, API, CLIENT, Message, Utils, Post }) {
	
	let { messageID, messageReply } = event;
	let photoURL;
	
	if (event.type === 'message_reply' && messageReply) {
		if (messageReply.attachments.length > 0) {
			const data = messageReply.attachments[0];
			if (data.type == 'photo') {
				photoURL = messageReply.attachments[0].url;
			}
		}
	} else {
		photoURL = args.join('');
	}
	
	if (photoURL) {
		Message.react('inprogress', messageID);
		await Promise.race([
			Axios.get(`https://code-merge-api-hazeyy01.replit.app/api/try/remini?url=${encodeURIComponent(photoURL)}`),
			new Promise((_, rej) => setTimeout(() => rej('--timeout-error'), 10000))
		]).then(async (result) => {
			await Axios.get(result.data.image_data, { responseType: 'stream' }).then((stream) => {
				Message.reply(
					{
						body: `✨ Enhanced Successfully`,
						attachment: stream.data
					},
					async (err) => {
						if (!err) {
							await Post.addUserCooldown();
							Message.react('success', messageID);
						} else {
							Message.react('error', messageID);
						}
					}
				);
			}).catch((err) => {
				Message.react('error', messageID);
				Message.reply(Utils.textFormat('errors', 'errorMsg', 'Unable to process, Try again later.'));
			});
		}).catch((err) => {
			Message.react('error', messageID);
			Message.reply(Utils.textFormat('errors', 'errorMsg', 'Request Time-out, Try again later.'));
		});
	} else {
		if (event.type == 'message_reply') {
			Message.react('error', messageID);
			Message.reply(Utils.textFormat('errors', 'errorMsg', 'No photo was found in the reply message.'));
		} else {
			Message.react('error', messageID);
			Message.reply(Utils.textFormat('errors', 'errorMsg', 'No URL was found in the reply message.'));
		}
	}
}