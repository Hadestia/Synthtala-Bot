const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.run = async function ({ args, event, API, BOT_INFO, CLIENT, Message, Post, Utils, Users }) {
	
	const { senderID, threadID, messageID, mentions, messageReply } = event;
	const n_a = Utils.textFormat('miscs', 'noDataTxtFont');
	
	const unableToRetrivedInfo = (e) => {
		(e) ? Post.logModuleError(e) : '';
		Message.react('error');
		return Message.reply(Utils.textFormat('errors', 'errorMsg', `No matching results or unable to retrieve information.`));
	}
	
	const forwardInfo = async (Info) => {
		const body = Utils.textFormat('formats', 'userInfoSimpleFormat',
			Info.name || `user${Info.id}`,
			Info.username || Info.id || n_a,
			//Info.relationship_status || n_a,
			Info.gender || n_a,
			//Info.birthday || n_a,
			//Info.follower || n_a,
			//Info.location || n_a,
			//Info.hometown || n_a,
			Info.id || n_a,
			Info.username || Info.id || n_a
		);
		
		// download avatar
		const path = Path.join(CLIENT.CACHE_PATH, `avatar-${Info.id}-${Utils.randomString(6)}.jpg`);
		await Users.getAvatar(Info.id, path).then((post) => {
			return Message.reply(
				{ body, attachment: post.stream },
				async (err, info) => {
					(err) ? Message.react('error') : await Post.addUserCooldown();
					post.deleteImage();
					//Utils.autoUnsend(err, info);
				}
			);
		}).catch((err) => {
			return Message.reply(
				body,
				async (err, info) => {
					(err) ? Utils.sendReaction('error') : await Post.addUserCooldown();
					Utils.autoUnsend(err, info);
				}
			);
		});
	}
	
	
	// Handle Message Reply
	if (event.type == 'message_reply') {
		getInfo(messageReply.senderID).then(forwardInfo).catch(unableToRetrivedInfo);
	// Handle Mentioned User
	} else if (mentions && Object.keys(mentions).length > 0) {
		getInfo(Object.keys(mentions)[0]).then(forwardInfo).catch(unableToRetrivedInfo);
	} else {
		// Handle Requester
		if (args.length == 0) {
			getInfo(senderID).then(forwardInfo).catch(unableToRetrivedInfo);
		// Handle Manual Search
		} else {
			let query = args.join(' ');
			// Handle Visible ID via Facebook link
			if (isValidProfileURL(query)) {
				// Remove extra parameters from a link
				const extraParamIndex = query.indexOf('?');
				query = (extraParamIndex >= 0) ? query.substring(0, extraParamIndex) : query;
				const getLastPart = (query.match(/[A-Za-z0-9_.]+$/) || [ false ])[0];
				if (getLastPart) {
					// Found userID from the link?
					if (!isNaN(getLastPart)) {
						getInfo(getLastPart).then(forwardInfo).catch(unableToRetrivedInfo);
					} else {
						// Try searching using username
						getID(getLastPart).then((id) => {
							getInfo(id).then(forwardInfo).catch(unableToRetrivedInfo);
						}).catch(unableToRetrivedInfo);
					}
				} else {
					unableToRetrivedInfo();
				};
			// Handle Manual Keyword Search
			} else {
				// Handle UID argument
				if (!isNaN(query)) {
					getInfo(query).then(forwardInfo).catch(unableToRetrivedInfo);
				} else {
					getID(query).then((id) => {
						getInfo(id).then(forwardInfo).catch(unableToRetrivedInfo);
					}).catch(unableToRetrivedInfo);
				}
			}
		}
	}
	
	function isValidProfileURL(url) {
		const regExp = new RegExp(/^https:\/\/(\w+)?\.?facebook\.com\/(?:profile\.php\?id=(\d+)|([A-Za-z0-9_.]+))[^\/|\/\.*]$/)
		return regExp.test(url);
	}
	
	async function getID(keyword) {
		return new Promise (async (resolve, reject) => {
			try {
				await API.getUserID(keyword, (err, info) => {
					if (err) {
						reject(err);
					} else {
						if (info.length > 0) {
							resolve(info[0].userID);
						} else {
							reject('No Result');
						}
					}
				});
			} catch (err) {
				reject(err);
			}
		});
	}
	
	async function getInfo(id) {
		return new Promise (async (resolve, reject) => {
			try {
				const result = await Users.getInfo(id);
				if (!result) {
					reject('No Info Found');
				} else {
					resolve(result);
				}
			} catch (err) {
				reject(err);
			}
		});
	}
}