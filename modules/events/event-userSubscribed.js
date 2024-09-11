const Filesystem = require('fs-extra');
const Canvas = require('canvas');
const Axios = require('axios');
const Path = require('path');


module.exports.run = async function ({ event, Utils, API, CLIENT, BOT_INFO, Threads, Users }) {
	
	const { threadID, author, logMessageData } = event;
	const addedMember = logMessageData.addedParticipants || [];
	
	// @Bot Joined Thread
	if (addedMember.some(i => i.userFbId === BOT_INFO.ID)) {
		return Utils.initBotJoin(threadID);
	}
	
	const groupData = await Threads.getData(threadID);
	const allow_anti_join = (groupData && groupData.settings) ? groupData.settings['allow-anti-join'] : false;
	
	if (allow_anti_join) return;
	
	const { imageSrc, threadName, participantIDs } = await API.getThreadInfo(threadID);
	const thread_name = removeNonASCII((threadName || 'This Group').normalize('NFKD'));
	
	if (addedMember.length > 1) {
		try {
			const mentions = [], names = [];
			for (const user of addedMember) {
				const splitName = (removeNonASCII((user.fullName).normalize('NFKD'))).split(' ');
				const shortName = (splitName.length > 2) ? `${splitName[0]} ${splitName[1]}` : user.fullName;
				names.push(shortName);
				mentions.push({ tag: shortName, id: user.userFbId });
			}
			
			const welcome_mem_path = Path.join(CLIENT.CACHE_PATH, 'keep/welcome_members.gif');
			const title = await Utils.fancyFont.get('Welcome Members!', 1);
			const subtitles = `Welcome ${await names.join(', ')}.\n\nWe're so glad you're here! Your contributions will be invaluable to our discussions.`;
			API.sendMessage(
				{
					body: Utils.textFormat('formats', 'headerNContentBoldFormat', title, subtitles),
					mentions,
					attachment: (Filesystem.existsSync(welcome_mem_path)) ? Filesystem.createReadStream(welcome_mem_path) : []
				},
				threadID,
				Utils.autoUnsend
			);
		} catch (err) {
			console.error(err);
		}
	} else {
		try {
			const truncated_user_pos = truncByChar(`${getOrdinalPosition(participantIDs.length)} member of ${thread_name}`, 26);
			const user = addedMember[0];
			const user_name = shortenUserName(user.fullName, 17);
			
			const final_welcome_path = Path.join(CLIENT.CACHE_PATH, `joinNoti_${user.userFbId}_@${threadID}.jpg`);
			
			// get user avatar && group image
			const avatar = await Users.getAvatar(user.userFbId, `${CLIENT.CACHE_PATH}/avatar-${user.userFbId}.png`);
			
			// some of group don't have group photo
			let groupAvatar;
			if (imageSrc) {
				const groupAvaPath = `${CLIENT.CACHE_PATH}/groupAva-${threadID}.png`;
				const groupPhoto = (await Axios.get(imageSrc, { responseType: 'arraybuffer' })).data;
				
				Filesystem.writeFileSync(groupAvaPath, Buffer.from(groupPhoto, 'utf-8'));
				const circle_groupPhoto = await Utils.makeCircleImg(groupAvaPath);
				try { Filesystem.unlinkSync(groupAvaPath); } catch (_) {}
				groupAvatar = await Canvas.loadImage(circle_groupPhoto);
			}
			
			const circle_userAva = await Utils.makeCircleImg(avatar.path);
			const userAvatar = await Canvas.loadImage(circle_userAva);
			avatar.deleteImage();

			// PREPARE OVERLAYS
			const topImg = await Canvas.loadImage(Path.resolve(CLIENT.CACHE_PATH, 'keep/thumb-top_styleUserJoin.png'));
			const oilrigFrame = await Canvas.loadImage(Path.join(CLIENT.CACHE_PATH, 'keep/oilrigBG.jpg'));
			
			// PREPARE FONTS
			Canvas.registerFont(Path.join(CLIENT.CACHE_PATH, 'keep/fonts', 'BungeeInline-Regular.ttf'), { family: 'BungeeInline-Regular' });
			Canvas.registerFont(Path.join(CLIENT.CACHE_PATH, 'keep/fonts', 'Bevan-Regular.ttf'), { family: 'Bevan-Regular' });
			
			const mCanvas = Canvas.createCanvas(topImg.width, topImg.height);
			const ctx = mCanvas.getContext('2d');
			
			// ## Images
			ctx.drawImage(oilrigFrame, 0, 0, mCanvas.width, mCanvas.height);
			ctx.drawImage(topImg, 0, 0, mCanvas.width, mCanvas.height);
			
			// avatars
			ctx.drawImage(userAvatar, 49, 74, 90, 90);
			(groupAvatar) ? ctx.drawImage(groupAvatar, (mCanvas.width - (55 + 10)), 5, 55, 55) : '';
				
			// ## Texts
			ctx.fillStyle = '#ffffff';
			ctx.font = '25px BungeeInline-Regular';
			// name
			ctx.fillText(user_name, 168, 115);
			// lower text
			ctx.font = '15px Bevan-Regular';
			ctx.fillText(truncated_user_pos, 168, 140);
			
			const resultBuffer = mCanvas.toBuffer();
			Filesystem.writeFileSync(final_welcome_path, resultBuffer);
			
			API.sendMessage(
				{
					body: `Hello everyone, please welcome ${user_name} to the group! We're so glad to have you here. Feel free to introduce yourself and share a bit about your interests. We're a friendly bunch and always happy to chat.`,
					attachment: Filesystem.createReadStream(final_welcome_path),
					mentions: [{ tag: user_name, id: user.userFbId }]
				},
				threadID,
				(e, info) => {
					Utils.autoUnsend(e, info);
					Filesystem.unlinkSync(final_welcome_path);
				}
			);
			
		} catch (err) {
			console.error(err);
		}
	}
}

// remove non ascii characters on a string
function removeNonASCII(str) {
	return str.replace(/[^\x20-\x7E]/g, '');
}

function truncByChar(str, n) {
	return (str.length > n) ? str.slice(0, n-1) + '...' : str;
}

function shortenUserName(name, maxchar) {
	const participant_name = ((name).normalize('NFKD')).split(' ');
	let shorten_user_name = (participant_name.length > 3) ? `${participant_name[0]} ${(participant_name).pop()}` : name;
	return (shorten_user_name.length > maxchar) ? shorten_user_name.slice(0, maxchar - 3) + '...' : shorten_user_name;
}

function getOrdinalPosition(pos) {
	let order = '';
	const numberString = String(pos);
	const endNum = parseInt(numberString[numberString.length - 1]);
	order = (endNum == 1) ? 'st' : (endNum == 2) ? 'nd' : (endNum == 3) ? 'rd' : 'th';
	return `${pos}${order}`;
}