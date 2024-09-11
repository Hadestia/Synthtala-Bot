const Filesystem = require('fs-extra');
const Ytdl = require('@distube/ytdl-core');
const Axios = require('axios');
const Path = require('path');


module.exports.run = async function ({ args, event, API, CLIENT, Message, Post, Utils, ModuleData, HandleCommandReply }) {
	
	const { threadID, messageID, senderID } = event;
	
	let query = args.join(' ');
	const isValidYTURL = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
	const isYTURL = isValidYTURL.test(query);
	
	Message.react('🔍');
	// handle search via link
	if (isYTURL) {
		try {
			Message.react('inprogress');
			await downLoadRequest( event, query, null, { messageRequestID: messageID }, threadID, CLIENT, Utils, Message, function (err) {
				if (err) {
					handleDownloadError(err, API, threadID, messageID, Utils);
					Message.react('error', messageID);
				} else {
					Message.react('success', messageID);
					Post.addUserCooldown();
				}
			});
		} catch (err_link_req) {
			console.error(err_link_req);
			return Utils.sendReaction('error', messageID);
		}
	} else {
		// handle search manually
		try {
			// check for skip options
			let skip = false;
			const inputExpression = new RegExp('\-s|-S .*');
			
			if (inputExpression.test(query)) {
				query = (query.slice(2)).trim();
				skip = true;
			}
			
			const maxResults = 6;
			await Axios.get(encodeURI(`https://www.googleapis.com/youtube/v3/search?key=${ModuleData.placeholders.youtubeAPI}&part=snippet&q=${query}&maxResults=${maxResults}&type=video`)).then(async(response) => {
				const results = response.data.items;
				// No result Found?
				if (results.length === 0) {
					return API.sendMessage(
						Utils.textFormat('errors', 'errorMsg', `No search results found for ${query}.`),
						threadID, Utils.autoUnsend, messageID
					);
				}
				
				if (skip) {
					try {
						const chosen_result = results[0];
						const video_id = chosen_result.id.videoId;
						const video_title = chosen_result.snippet.title;
						Message.react('inprogress');
						await downLoadRequest( event, video_id, video_title, { messageRequestID: messageID }, threadID, CLIENT, Utils, Message, function (err) {
							if (err) {
								handleDownloadError(err, API, threadID, messageID, Utils);
								Message.react('error');
							} else {
								Message.react('success');
								Post.addUserCooldown();
							}
						});
					} catch (err_skip_req) {
						Message.react('error');
					}
				} else {
					let index = 0, msg = '';
					const thumbnails = [], id_arrays = [];
				
					for (const info of results) {
						const video_id = info.id.videoId;
					
						await Axios.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${video_id}&key=${ModuleData.placeholders.youtubeAPI}`).then(async(result) => {
						
							const api_info = result.data.items[0];
							const time = (api_info.contentDetails.duration.slice(2)).toLowerCase();
							const list_thumbs = Object.values(api_info.snippet.thumbnails);
							const thumb_url = list_thumbs[list_thumbs.length - 1].url;
							// Get Stream
							await Axios.get(thumb_url, { responseType: 'stream' }).then((stream) => {
								thumbnails[thumbnails.length] = stream.data;
								}).catch((err) => {});
						}).catch((err) => {});
					
						id_arrays[id_arrays.length] = video_id;
						msg += `${Utils.textFormat('formats', 'searchItemFormat', index+=1, formatTitle(info.snippet.title))}\n`;
					}
				
					const messageBody = {
						body: Utils.textFormat('formats', 'searchResultFormat', msg),
						attachment: thumbnails
					};
					return Message.reply(
						messageBody,
						(e, msg_info) => {
							if (e) return Utils.sendReaction('error', messageID);
							Utils.autoUnsend(e, msg_info, 120);
							HandleCommandReply.addReplyInfo({
								expiration: Date.now() + (120 * 1000),
								messageID: msg_info.messageID,
								messageRequestID: messageID,
								commandID: ModuleData.id,
								senderID: senderID,
								data: results
							});
						}
					);
				}
			}).catch((err) => {
				console.error(err);
				Message.react('error', messageID);
				Message.reply(Utils.textFormat('errors', 'errorMsg', err), Utils.autoUnsend);
			});
			return;
		} catch (api_second_error_manual_search) {
			console.error(api_second_error_manual_search)
			Message.react('error', messageID);
			Message.reply(Utils.textFormat('errors', 'errorMsg', api_second_error_manual_search), Utils.autoUnsend);
		}
	}
}

module.exports.handleReply = async function ({ event, replyInfo, API, CLIENT, Message, Post, Utils }) {
	
	const { body, threadID, messageID, senderID } = event;
    
    let selection = body.match(/\d+/g);
    if (!selection || Math.abs(parseInt(selection[0])) < 1 || Math.abs(parseInt(selection[0])) > (replyInfo.data).length) {
		return Post.invalid_reply_usage();
	}
    
    selection = Math.abs(parseInt(selection[0]));
    
    try {
    	const { data, messageRequestID } = replyInfo;
		const chosen_result = data[selection - 1];
		const video_id = chosen_result.id.videoId;
		const video_title = formatTitle(chosen_result.snippet.title);
		Post.deleteReplyInfo();
		Message.react('inprogress');
		Message.react('inprogress', messageRequestID);
		await downLoadRequest( event, video_id, video_title, replyInfo, threadID, CLIENT, Utils, Message, function (err) {
			if (err) {
				handleDownloadError(err, API, threadID, messageID, Utils);
				Message.react('error');
				Message.react('error', messageRequestID);
			} else {
				Message.react('success');
				Message.react('success', messageRequestID);
				Post.addUserCooldown();
			}
		});
    } catch (e) {
		console.error(e);
    	Message.react('error', messageID);
    }
}

function handleDownloadError(err, API, threadID, messageID, Utils) {
	
	const send = (e) => API.sendMessage(Utils.textFormat('errors', 'errorMsg', e), threadID, () => {}, messageID);
	
	switch (err) {
		case 'no-videoid':
			send('No video ID found on the request.');
			break;
		case 'invalid-url':
			send('Invalid YouTube URL.');
			break;
		case 'live-stream':
			send('Cannot process "LIVE" video.');
			break;
		case 'long-video':
			send('Cannot process music longer than 12 minutes.');
			break;
		case 'huge-video':
			send('Cannot process music over 26mb.');
			break;
		default:
			send('Unable to process your request. kindly try again or try another result.');
			break;
	}
	console.error(err);
}

async function downLoadRequest( event, videoID, videoTitle, replyInfo, threadID, CLIENT, Utils, Message, callback) {
	try {
		
		const video_info = await Ytdl.getInfo(videoID);
		
		const formats = ((video_info.formats).filter(i => i.mimeType.includes('video/mp4') && i.mimeType.includes('mp4a'))).sort((a, b) => parseInt(b.contentLength) - parseInt(a.contentLength));
		const video_size = formats.contentLength;
			
		const video_id = (Ytdl.validateURL(videoID)) ? Ytdl.getURLVideoID(videoID) : videoID;
			
		if (video_size > 27262976) {
			return callback('huge-video');
		}
			
		if (video_info.live_playback) {
			return callback('live-stream');
		}
		
		const dl_path = `${CLIENT.CACHE_PATH}/ytdl${event.senderID}${Utils.randomString(9)}.mp3`;
		await Ytdl.downloadFromInfo(video_info, { quality: 'highestaudio' }).pipe(Filesystem.createWriteStream(dl_path)).on('close', async function () {
			await Message.send(
				{
					body: Utils.textFormat('formats', 'starBulletResult', formatTitle(videoTitle || video_info.videoDetails.title)),
					attachment: Filesystem.createReadStream(dl_path)
				},
				threadID,
				replyInfo.messageRequestID,
				(e) => {
					Filesystem.unlinkSync(dl_path);
					callback(e);
				}
			);
		}).on('error', function (err) {
			callback(err);
		});
			
	} catch (err) {
		callback(err);
	}
}

function formatTitle(str) {
	return str.replace(/\&quot;/g, '"')
		.replace(/\&\#39;/g, '\'')
		.replace(/\&amp;/g, '&');
}


/* LEGACY CODE
const Filesystem = require('fs-extra');
const Path = require('path');

module.exports.run = async function ({ args, event, API, CLIENT, Message, Post, Utils, ModuleData, HandleCommandReply }) {
	
	const { threadID, messageID, senderID } = event;
	
	const song = args.join(' ');
	
	Message.react('🔍');
	// handle search via link
	if (song.indexOf('https://') !== -1) {
		try {
			Message.react('inprogress');
			const path = Path.join(CLIENT.CACHE_PATH, `req-${senderID}`);
			await download(song, path).then((data) => {
				return Message.reply(
					{ 
						body: Utils.textFormat('formats', 'starBulletResult', data.title),
						attachment: Filesystem.createReadStream(data.path)
					},
					(e) => {
						if (!e) {
							Post.addUserCooldown();
							Message.react('success', messageID);
						} else {
							Message.react('error', messageID);
						}
						try { return Filesystem.unlinkSync(data.path) } catch (err) {}
					}
				);
			}).catch((err) => {
				handleDownloadError(err, API, threadID, messageID, Utils);
				Message.react('error', messageID);
			});
					
		} catch (err_link_req) {
			console.error(err_link_req);
			Message.react('error', messageID);
			//Utils.sendRequestError(err_link_req, event, Prefix);
			return // Utils.logModuleErrorToAdmin(err_link_req, __filename, event);
		}
		return;
	}
			
	// handle via search manually
	try {
		const link = [];
		let msg = '', num = 0;

		const Youtube = require('youtube-search-api');
		const data = (await Youtube.GetListByKeyword(song, false, 6)).items;
				
		for (const value of data) {
			link.push(value.id);
			num += 1;
			msg += `${Utils.textFormat('formats', 'searchItemFormat', num, value.title)}\n`;
		}
				
		const messageBody = Utils.textFormat('formats', 'searchResultFormat', msg);
				
		return Message.reply(
			messageBody,
			(e, info) => {
				if (e) return // Utils.sendRequestError(e, event, Prefix);
				Utils.autoUnsend(e, info, 120);
				HandleCommandReply.addReplyInfo({
					expiration: Date.now() + (120 * 1000),
					messageID: info.messageID,
					messageRequestID: messageID,
					commandID: ModuleData.id,
					senderID: senderID,
					data: link
				});
			}
		);
	} catch (api_second_error_manual_search) {
		console.error(api_second_error_manual_search)
		Message.react('error', messageID);
		//Utils.sendRequestError(api_second_error_manual_search, event, Prefix)
		//return Utils.logModuleErrorToAdmin(api_second_error_manual_search, __filename, event);
	}
}

module.exports.handleReply = async function ({ event, replyInfo, API, CLIENT, Post, Utils, Message }) {
	
	const { body, threadID, messageID, senderID } = event;
    let selection = body.match(/\d+/g);
    
    if (!selection || Math.abs(parseInt(selection[0])) < 1 || Math.abs(parseInt(selection[0])) > (replyInfo.data).length) return Post.invalid_reply_usage();
    
    selection = Math.abs(parseInt(selection[0]));
    
    try {
        const path = Path.join(CLIENT.CACHE_PATH, `req-${senderID}`);
        const videoID = replyInfo.data[selection - 1];
        
        Message.react('inprogress', replyInfo.messageRequestID);
		Message.react('inprogress', messageID);
		
		Post.deleteReplyInfo();

        await download('https://www.youtube.com/watch?v=' + videoID, path).then((data) => {
        	API.sendMessage(
				{ 
					body: Utils.textFormat('formats', 'starBulletResult', data.title),
					attachment: Filesystem.createReadStream(data.path)
				},
				threadID,
				(e) => {
					if (!e) {
						Post.addUserCooldown();
						Message.react('success', messageID);
						Message.react('success', replyInfo.messageRequestID);
					} else {
						Message.react('error', replyInfo.messageRequestID);
						Message.react('error', messageID);
					}
					try { Filesystem.unlinkSync(data.path) } catch (err) {}
				},
				replyInfo.messageRequestID
			);
    	}).catch((err) => {
    		handleDownloadError(err, API, threadID, messageID, Utils);
    		Message.react('success', replyInfo.messageRequestID);
			Message.react('error', messageID);
    	});
    } catch (e) {
		console.error(e);
    	Message.react('error', replyInfo.messageID);
		// Utils.logModuleErrorToAdmin(e, __filename, event);
		// return api.sendMessage(Utils.textFormat('error', 'errCmdExceptionError', e, global.HADESTIA_BOT_CONFIG.PREFIX), threadID, messageID);
    }
}

function handleDownloadError(err, API, threadID, messageID, Utils) {
	
	const send = (e) => {
		API.sendMessage(Utils.textFormat('errors', 'errorMsg', e), threadID, messageID);
	}
	
	console.error(err);
	
	if (err == 'no-videoid') {
		send('No video ID found on the request.');
	} else if (err == 'invalid-url') {
		send('Invalid YouTube link URL.');
	} else if (err == 'live-stream') {
		send('Cannot process "LIVE" video.');
	} else if (err == 'long-music') {
		send('Cannot process music longer than 12 minutes.');
	} else {
		send(err);
	}
	return;
}

function download(link, path) {
	
	const ytdl = require('ytdl-core');
	
	return new Promise(async function (resolve, reject) {
		let videoID;
		try {
			if (!ytdl.validateURL(link)) {
				reject('invalid-url');
			}
			
			videoID = ytdl.getURLVideoID(link);
			
			if (!videoID) {
				reject('no-videoid');
			}
		} catch (err) {
			reject(err);
		}
		await ytdl.getInfo(videoID).then(async (info) => {
				
			if (info.live_playback) {
				reject('live-stream');
			}
			
			if (Number(info.videoDetails.lengthSeconds) > 720) {
				reject('long-music');
			}
				
			const final_path = `${path}${videoID}.mp3`;
			const stream = await ytdl.downloadFromInfo(info, { quality: 'highestaudio' }).pipe(Filesystem.createWriteStream(final_path));
				
			stream.on('close', function () {
				let result = {
					title: info.videoDetails.title,
					dur: Number(info.videoDetails.lengthSeconds),
					viewCount: info.videoDetails.viewCount,
					likes: info.videoDetails.likes,
					author: info.videoDetails.author.name,
					path: final_path
				}
				resolve(result);
			});
				
			stream.on('error', function (err) {
				reject(err);
			});
				
		}).catch((err) => {
			reject(err);
		});
	});
}
*/