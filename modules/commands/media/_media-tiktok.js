module.exports.run = async function({ event, args, API, CLIENT, Message, Utils, ModuleData, Post }) {
	
	const Path = require('path');
	const Axios = require('axios');
	const Filesystem = require('fs-extra');
	const Downloader = require('nayan-media-downloader');
    
	const { threadID, messageID, senderID } = event;
	
	Message.react('inprogress', messageID);
	
	const url = args[0];
	
	if (validateTiktokURL(url)) {
		try {
			// Caution: This process will automatically failed for other links e.g Sound Track
			const result = await Downloader.tikdown(url);
			const videoData = result.data;
			// Get Content Type (Some Tiktok Links are Slideshows which cannot locate its content images)
			Axios.head(videoData.video).then(async (data) => {
				const type = data.headers['content-type'];
				
				if (type.includes('video')) {
					const author = videoData.author
					const nickname = await Utils.fancyFont.get(author.nickname, 1);
					const path = Path.join(CLIENT.CACHE_PATH, `tiktokDL-${Date.now()}-${messageID}.mp4`);
					Utils.downloadFile(videoData.video, path).then(() => {
						Message.reply(
							{
								body: Utils.textFormat('formats', 'tiktokDlVideoInfoFormat', nickname, `@${author.unique_id}`, videoData.title, videoData.view, videoData.share),
								attachment: Filesystem.createReadStream(path)
							},
							(err) => {
								(!err) ? Message.react('success') : Message.react('error');
								Post.addUserCooldown();
								Filesystem.unlinkSync(path);
							}
						);
					}).catch((err) => { sendError(Message, Utils, Post, err); });
				} else {
					// other links
					Message.react('error');
					Message.reply(Utils.textFormat('errors', 'errorMsg', 'Unable to download other links than video.'));
				}
			}).catch((err) => { sendError(Message, Utils, Post, err); });
		} catch (err) {
			sendError(Message, Utils, Post, err);
		}
	} else {
		Message.react('error');
		Message.reply(Utils.textFormat('errors', 'errorMsg', 'Argument should be a valid tiktok video link.'));
	}
}

function validateTiktokURL(url) {
	const regExp = new RegExp(/^.*https:\/\/(\w+)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video)\/|\?shareId=|\&item_id=)(\d+))|\w+)/);
	return regExp.test(url);
}

function sendError(Message, Utils, Post, err) {
	Message.react('error');
	Message.reply(Utils.textFormat('errors', 'errorMsg', 'Unable to process your request due to some reasons, Kindly try again later.'));
	Post.logModuleError(err);
}