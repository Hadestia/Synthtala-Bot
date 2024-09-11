module.exports.run = async function({ event, args, API, CLIENT, Message, Utils, ModuleData, Post }) {
	
	const Path = require('path');
	const Axios = require('axios');
	const Filesystem = require('fs-extra');
	const Downloader = require('nayan-media-downloader');
    
	const { threadID, messageID, senderID } = event;
	
	Message.react('inprogress', messageID);
	
	let [ _, option, url ] = (args.join(' ')).match(/^.*?(-v|-V|-i|-I) (.*)$/) || [ false, false, false ];
	
	if (!_ && !option && !url) return Post.invalidSyntax();
	
	if (validateURL(url)) {
		try {
			option = option.toLowerCase();
			if (option == '-i' && url.includes('facebook.com')) {
				Message.react('error');
				Message.reply(Utils.textFormat('errors', 'errorMsg', 'This command cannot download Facebook Images'));
				return;
			}
			const attachment = [];
			const attachmentPath = [];
			const result = await Downloader.ndown(url);
			
			if (result.status && result.data) {
				if (option === '-i') {
					const map = {};
					for (const index in result.data) {
						const content = result.data[index];
						if (!map[content.url]) {
							await Axios.head(content.url).then(async (data) => {
								const type = data.headers['content-type'];
								if (type.includes('image')) {
									const path = Path.join(CLIENT.CACHE_PATH, `fb-instaDL-${Date.now()}-${messageID}.jpg`);
									await Utils.downloadFile(content.url, path).then(() => {
										attachment[attachment.length] = Filesystem.createReadStream(path);
										attachmentPath[attachmentPath.length] = path;
										map[content.url] = true;
									});
								}
							}).catch(() => {});
						}
					}
				} else {
					const content = result.data[0];
					await Axios.head(content.url).then(async (data) => {
						const type = data.headers['content-type'];
						if (type.includes('video') || type.includes('application/octet-stream')) {
							const path = Path.join(CLIENT.CACHE_PATH, `fb-instaDL-${Date.now()}-${messageID}.mp4`);
							await Utils.downloadFile(content.url, path).then(() => {
								attachment[attachment.length] = Filesystem.createReadStream(path);
								attachmentPath[attachmentPath.length] = path;
							});
						} else {
							// other links
							Message.react('error');
							Message.reply(Utils.textFormat('errors', 'errorMsg', 'Provided link is not a video.'));
						}
					}).catch((err) => { sendError(Message, Utils, Post, err); });
				}
				
				if (attachment.length > 0) {
					Message.reply(
						{ body: '', attachment },
						(err) => {
							(!err) ? Message.react('success') : Message.react('error');
							Post.addUserCooldown();
							for (const path of attachmentPath) {
								try { Filesystem.unlinkSync(path); } catch (err) {}
							}
						}
					);
				} else {
					Message.react('error');
				}
			} else {
				sendError(Message, Utils, Post, 'Couldn\'t fetch video/image URL');
			}
		} catch (err) {
			sendError(Message, Utils, Post, err);
		}
	} else {
		Message.react('error');
		Message.reply(Utils.textFormat('errors', 'errorMsg', 'Argument should be a valid Facebook/Instagram Video/Image link.'));
	}
}

function validateURL(url) {
	const regExp = new RegExp(/^.*https:\/\/(\w+)?\.?(facebook|instagram)\.com\/((?:.*\b(?:(?:share|p|video|reel)\/|\s*))?(==|))/);
	return regExp.test(url);
}

function getAbsoluteURL(url) {
	const result = url.match(/^.*https:\/\/(\w+)?\.?(facebook|instagram)\.com\/((?:.*\b(?:(?:share|p|video|reel)\/\w+)))/);
	return result[0];
}

function sendError(Message, Utils, Post, err) {
	Message.react('error');
	Message.reply(Utils.textFormat('errors', 'errorMsg', 'Unable to process your request due to some reasons, Kindly try again later.'));
	Post.logModuleError(err);
}