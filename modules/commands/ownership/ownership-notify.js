const Filesystem = require('fs-extra');
const Axios = require('axios');
const Path = require('path');

module.exports.run = async function ({ event, args, body, API, CLIENT, Message, Utils, Post, Threads }) {
	
	const hasDivider = body.indexOf('|') !== -1;
	
	if (!hasDivider) {
		Post.invalidSyntax();
	} else {
		
		const attachmentSend = [];
		const arrPathSave = [];

		async function getAttachments(attachments = []) {
			let startFile = 0;
			for (const data of attachments) {
				const ext = data.type == "photo" ? "jpg" :
					data.type == "video" ? "mp4" :
						data.type == "animated_image" ? "gif" :
							data.type == "audio" ? "mp3" :
								"txt";
				const pathSave = Path.join(CLIENT.CACHE_PATH, `/notif${Utils.randomString(16)}${startFile}.${ext}`);
				++startFile;
				const url = data.url;
				const res = await Axios.get(url, {
					responseType: "arraybuffer"
				});
				Filesystem.writeFileSync(pathSave, Buffer.from(res.data));
				attachmentSend.push(Filesystem.createReadStream(pathSave));
				arrPathSave.push(pathSave);
			}
		}
		
		let [ options, message ] = body.split('|');
		
		options = options.toLowerCase().trim();
		message = message.trim();
		
		// Who sent
		const regards = (CLIENT.CONFIG.botOwners.includes(event.senderID)) ? 'Owner' : 'Admin';
		const title = await Utils.fancyFont.get('Notification', 1);
		
		const formatMessage = {
			body: Utils.textFormat('formats', 'headerNContentBoldFormat', title, `${message}\n\n-${regards}`)
		}
		
		if (event.messageReply) {
			if (event.messageReply.attachments.length > 0) {
				await getAttachments(event.messageReply.attachments);
			}
		} else if (event.attachments.length > 0) {
			await getAttachments(event.attachments);
		}
		
		if (attachmentSend.length > 0) {
			formatMessage.attachment = attachmentSend;
		}
		
		const failedThreads = [], successThreads = [];
		
		// All ?
		if (options === '-all') {
			const allThreads = await Threads.getAll(['THREADID']);
			
			for (const Group of allThreads) {
				await new Promise((res, rej) => {
					API.sendMessage(
						formatMessage,
						Group.THREADID,
						async (err) => {
							if (err) {
								rej();
							} else {
								res();
							}
						}
					);
				}).then(() => successThreads[successThreads.length] = Group.THREADID).catch(() => failedThreads[failedThreads.length] = Group.THREADID);
			}
			
			Message.reply(Utils.textFormat('errors', 'warningMsg', `Sent to ${successThreads.length}/${allThreads.length} threads.`), () => {
				for (const pathSave of arrPathSave) Filesystem.unlinkSync(pathSave);
			});
		// Assuming it was a given thread ID
		} else {
			
			const givenIDs = options.split(' ');
			const isValid = givenIDs.every(id => !isNaN(id.trim()));
			
			if (options !== '' && isValid) {
				for (let threadID of givenIDs) {
					threadID = threadID.trim();
					await new Promise((res, rej) => {
						API.sendMessage(
							formatMessage,
							threadID,
							async (err) => {
								if (err) {
									rej();
								} else {
									res();
								}
							}
						);
					}).then(() => successThreads[successThreads.length] = threadID).catch(() => failedThreads[failedThreads.length] = threadID);
				}
				
				Message.reply(Utils.textFormat('errors', 'warningMsg', `Sent to ${successThreads.length}/${successThreads.length + failedThreads.length} threads.`), () => {
					for (const pathSave of arrPathSave) Filesystem.unlinkSync(pathSave);
				});
			} else {
				return Post.invalidSyntax();
			}
		}
	}
}