const Filesystem = require('fs-extra');
const Ytdl = require('@distube/ytdl-core');
const Axios = require('axios');
const Path = require('path');


module.exports.run = async function ({ args, event, API, CLIENT, Message, Post, Utils, ModuleData, HandleCommandReply }) {
	
	const { threadID, messageID, senderID } = event;
	
	const query = args.join(' ');
	const isValidYTURL = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
	const isYTURL = isValidYTURL.test(query);
	
	Message.react('🔍');
	// handle search via link
	if (isYTURL) {
		try {
			Message.react('inprogress');
			const callback = function (err) {
				if (err) {
					handleDownloadError(err, API, threadID, messageID, Utils);
					Message.react('error', messageID);
				} else {
					Message.react('success', messageID);
					Post.addUserCooldown();
				}
			};
			const replyInfo = { messageRequestID: messageID };
			await downLoadRequest( event, query, null, replyInfo, threadID, CLIENT, Utils, Message, callback);
		} catch (err_link_req) {
			console.error(err_link_req);
			return Utils.sendReaction('error', messageID);
		}
	} else {
		// handle search manually
		try {
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
		case 'no-video':
			send('Unable to find the video.');
			break;
		case 'huge-video':
			send('Cannot process video over 25mb.');
			break;
		default:
			send('Unable to process your request. kindly try again or try another result.');
			break;
	}
	console.error(err);
	return;
}

async function downLoadRequest( event, videoID, videoTitle, replyInfo, threadID, CLIENT, Utils, Message, CB) {
	try {
		
		const MAX_SIZE = 83 * 1024 * 1024; // 83 MB;
		
		const video_id = (Ytdl.validateURL(videoID)) ? Ytdl.getURLVideoID(videoID) : videoID;
		const video_info = await Ytdl.getInfo(video_id);
		
		const getFormat = (video_info.formats)
			.filter(f => f.hasAudio && f.hasVideo && f.quality === 'tiny' && f.audioBitrate == 128)
			.sort((a, b) => b.contentLength - a.contentLength)
			.find(f => f.contentLength || 0 < MAX_SIZE);
		
		if (video_info.live_playback) {
			return callback('live-stream');
		}
		
		if (!getFormat) {
			return callback('no-video');
		}
		
		const getStream = await getStreamAndSize(getFormat.url);
		
		if (getStream.size > MAX_SIZE) {
			return callback('huge-video');
		}
			
		const save_path = `${CLIENT.CACHE_PATH}/ytdl${event.senderID}${Utils.randomString(9)}.mp4`;
		
		getStream.stream.pipe( Filesystem.createWriteStream(save_path) );
		
		getStream.on('finish', async function () {
			await Message.send(
				{
					body: Utils.textFormat('formats', 'starBulletResult', formatTitle(videoTitle || video_info.videoDetails.title)),
					attachment: Filesystem.createReadStream(save_path)
				},
				threadID,
				replyInfo.messageRequestID,
				(e) => {
					Filesystem.unlinkSync(save_path);
					callback(e);
				}
			);
		});
		
		getStream.on('error', function ( err ) {
			callback(err);
		});
	} catch (err) {
		callback(err);
	}
}

async function getStreamAndSize( url ) {
	const response = await Axios({
		method: "GET",
		url,
		responseType: "stream",
		headers: {
			'Range': 'bytes=0-'
		}
	});
	
	return {
		stream: response.data,
		size: response.header["content-length"]
	};
}

function formatTitle(str) {
	return str.replace(/\&quot;/g, '"')
		.replace(/\&\#39;/g, '\'')
		.replace(/\&amp;/g, '&');
}