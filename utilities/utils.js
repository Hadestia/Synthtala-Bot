const os = require('os');
const crypto = require('crypto');
const Logger = require('./logger.js');
const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.cleanAnilistHTML = function (text) {
	text = text
		.replace('<br>', '\n')
		.replace(/<\/?(i|em)>/g, '*')
		.replace(/<\/?b>/g, '**')
		.replace(/~!|!~/g, '||')
		.replace("&amp;", "&")
		.replace("&lt;", "<")
		.replace("&gt;", ">")
		.replace("&quot;", '"')
		.replace("&#039;", "'");
	return text;
}

module.exports.downloadFile = function (url, path) {
	return new Promise (async (resolve, reject) => {
		try {
			const { createWriteStream } = require('fs');
			const axios = require('axios');

			const response = await axios({
				method: 'GET',
				responseType: 'stream',
				url
			});

			const writer = createWriteStream(path);

			response.data.pipe(writer);
			writer.on('finish', resolve);
			writer.on('error', reject);
		} catch (e) {
			reject(e);
		}
	});
};

module.exports.randomString = function (length) {
	var result           = '';
	var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	var charactersLength = characters.length || 5;
	for ( var i = 0; i < length; i++ ) result += characters.charAt(Math.floor(Math.random() * charactersLength));
	return result;
}

module.exports.AES = {
	encrypt (cryptKey, crpytIv, plainData) {
		var encipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(crpytIv));
        var encrypted = encipher.update(plainData);
		encrypted = Buffer.concat([encrypted, encipher.final()]);
		return encrypted.toString('hex');
	},
	decrypt (cryptKey, cryptIv, encrypted) {
		encrypted = Buffer.from(encrypted, "hex");
		var decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(cryptKey), Buffer.from(cryptIv, 'binary'));
		var decrypted = decipher.update(encrypted);
	
		decrypted = Buffer.concat([decrypted, decipher.final()]);
	
		return String(decrypted);
	},
	makeIv () { return Buffer.from(crypto.randomBytes(16)).toString('hex').slice(0, 16); }
}

module.exports.homeDir = function () {
	var returnHome, typeSystem;
	const home = process.env["HOME"];
	const user = process.env["LOGNAME"] || process.env["USER"] || process.env["LNAME"] || process.env["USERNAME"];

	switch (process.platform) {
		case "win32": {
			returnHome = process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH || home || null;
			typeSystem = "win32"
			break;
		}
		case "darwin": {
			returnHome = home || (user ? '/Users/' + user : null);
			typeSystem = "darwin";
			break;
		}
		case "linux": {
			returnHome =  home || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
			typeSystem = "linux"
			break;
		}
		default: {
			returnHome = home || null;
			typeSystem = "unknow"
			break;
		}
	}

	return [typeof os.homedir === 'function' ? os.homedir() : returnHome, typeSystem];
}

module.exports.isValidURL = function (string) {
	var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
		'((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
		'(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
		'(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
	return !!urlPattern.test(string);
}

module.exports.removeNonASCII = function (str) {
	return (str.replace(/[^\x20-\x7E]/g, '')).normalize('NFKD');
}


module.exports.getDirFiles = function (path, filterFunc) {
	function hasContents(path) {
		try {
			const files = Filesystem.readdirSync(path);
			return files.length > 0;
		} catch (err) {
			return false;
		}
	}
	let arr = [];
	if (hasContents(path)) {
		arr = Filesystem.readdirSync(path);
		return (filterFunc) ? arr.filter(filterFunc) : arr;
	} else {
		return arr;
	}
}

module.exports.formatRuntime = function (runtime) {
	const hrs = Math.floor(runtime / 3600);
	const mins = Math.floor((runtime % 3600) / 60);
	const secs = Math.floor(runtime % 60);
	return `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
}

module.exports.formatBytes = function (bytes) {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let index = 0;
	while (bytes >= 1024 && index < units.length - 1) {
		bytes /= 1024;
		index++;
	}
	return `${bytes.toFixed(2)} ${units[index]}`;
}

// Get memory usage of a specific process
module.exports.getProcessMemoryUsage = function (process) {
	
	const memoryUsage = process.memoryUsage();
	const rss = module.exports.formatBytes(memoryUsage.rss);
	const heapTotal = module.exports.formatBytes(memoryUsage.heapTotal);
	const heapUsed = module.exports.formatBytes(memoryUsage.heapUsed);
	const external = module.exports.formatBytes(memoryUsage.external);
	
	return { rss, heapTotal, heapUsed, external };
}

/// INTERNAL UTILITY FUNCTIONS 

module.exports.INTERNAL = async function ({ API, BOT_INFO, CLIENT, Users, Banned, Commands, Threads }) {
	
	const Axios = require('axios');
	
	//const editGif = require('./editGif.js');
	const fancyFont = require('./fancyFont.js');
	
	const textFormatter = require('../json/ref-textFormat.json');
	const databaseReference = Filesystem.readJsonSync(`${CLIENT.ROOT_PATH}/json/ref-defaultDatabase.json`);

	const Utils = {};
	
	/// CONSTANTS...
	Utils.TEXT_FORMAT_REF = textFormatter;
	
	// FUNCTIONS...
	Utils.getProcessMemoryUsage = this.getProcessMemoryUsage;
	Utils.cleanAnilistHTML = this.cleanAnilistHTML;
	Utils.removeNonASCII = this.removeNonASCII;
	Utils.formatRuntime = this.formatRuntime;
	Utils.downloadFile = this.downloadFile;
	Utils.randomString = this.randomString;
	Utils.formatBytes = this.formatBytes;
	Utils.isValidURL = this.isValidURL;
	Utils.homeDir = this.homeDir;
	Utils.AES = this.AES;
	
	Utils.Logger = Logger;
	Utils.fancyFont = fancyFont;
	//Utils.editGif = editGif;
	
	Utils.saveBotConfig = function (configObj) {
		Filesystem.writeJsonSync(CLIENT.CONFIG_PATH, configObj, { spaces: '\t' });
	}
	
	Utils.textFormat = function (category, key, ...values) {
		
		if (!textFormatter[category]) {
			const msg = `TextFormat | Category: ${category} cannot be found on text format libraries.`;
			Logger.makeLog(Utils.LOG_PATH, msg, 'error');
			throw new Error(msg);
		} else if (!textFormatter[category][key]) {
			const msg = `TextFormat | Id: ${key} cannot be found on category ${category}.`;
			Logger.makeLog(Utils.LOG_PATH, msg, 'error');
			throw new Error(msg);
		}
		
		let result = textFormatter[category][key];
		for (var i = values.length; i > 0; i--) {
        	const regEx = RegExp(`%${i}%`, 'g');
        	result = result.replace(regEx, values[i-1]);

    	}
    	return result;
    
	}
	
	Utils.sendReaction = async function (type, messageID, callback = () => {}) {
		const response = textFormatter.bot_reactions[type] || type || '';
		await API.setMessageReaction(response, messageID, callback, !![]);
	}

	Utils.setBotNickname = async function (prefix, custom, threadID) {
		
		const name = await Utils.fancyFont.get(custom || `${BOT_INFO.NAME.split(' ')[0]} Bot`, 1);
		const nickname = CLIENT.CONFIG.defaultNicknameFormat
			.replace('{bot-name}', name)
			.replace('{bot-prefix}', prefix || CLIENT.CONFIG.defaultPrefix);
			
		API.changeNickname(nickname, threadID, BOT_INFO.ID);
	}
	
	Utils.initBotJoin = async function (threadID, welcome_msg = true) {
		Utils.setBotNickname(null, null, threadID);
		if (welcome_msg) {
			return API.sendMessage(
				Utils.textFormat('events', 'botAddedToGroupIntro', BOT_INFO.NAME, CLIENT.CONFIG.defaultPrefix),
				threadID,
				() => {}
			);
		}
	}
	
	Utils.sendRequestError = async function (err, event, prefix) {
		API.sendMessage(Utils.textFormat('error', 'errCmdExceptionError', err.message, prefix), event.threadID, ()=>{}, event.messageID);
	}
	
	Utils.hasPermission = async function (event, permission) {
		// * userID was for event type: 'message_reaction'
		const senderID = event.userID || event.senderID;
		const GroupData = await Threads.getData(event.threadID);
		let groupInfo = (GroupData) ? GroupData.threadInfo : databaseReference.group_db.threadInfo;
		
		const isBotAdmin = CLIENT.CONFIG.botAdmins.includes(senderID);
		const isBotOwner = CLIENT.CONFIG.botOwners.includes(senderID);
		const isGroupAdmin = (event.isGroup) ? groupInfo.adminIDs.includes(senderID) : false;
				
		let isEligible = false

		switch (permission) {
			case -1: // Owner
				isEligible = isBotOwner;
				break;
			case 1: // For Group Admin
				isEligible = isGroupAdmin;
				break;
			case 2: // For Bot Admin
				isEligible = isBotAdmin;
				break;
			case 3: // Bot Admin + Owner
				isEligible = isBotAdmin || isBotOwner;
				break;
			case 4: // Bot Admin + Owner + Group Admin
				isEligible = isBotAdmin || isBotOwner || isGroupAdmin;
				break;
			default: // For All
				isEligible = true;
				break;
		}
		return isEligible;
	}
	
	Utils.logModuleErrorToAdmin = async function (err, filename, event) {
		console.error(filename, err);
		let name = '<DIRECT MESSAGE>';
		if (event.isGroup) {
			const data = await Threads.getData(event.threadID);
			name = (data) ? data.threadInfo.threadName : 'Uninitialize Group';
		}
		for (const admin of CLIENT.CONFIG.botOwner) {
			API.sendMessage(Utils.textFormat('events', 'eventModulesErrorToAdmin', filename, err, name || 'No Data', event.threadID, event.senderID), admin);
		}
	}
	
	Utils.autoUnsend = async function (err, info, delay = 120) {
		if (err) return console.log('AUTO UNSEND MESSAGE:', err);
		await new Promise(resolve => setTimeout(resolve, delay * 1000));
		return API.unsendMessage(info.messageID);
	}
	
	Utils.getModuleText = function (module = {}, event) {
    	if (!module.language) return function () {};
       
        return function (...values) {
        	if (!module.language.hasOwnProperty(CLIENT.CONFIG.language)) {
        		const msg = Utils.textFormat('error', 'moduleNotFoundLanguage', module.name);
        		API.sendMessage(msg, event.threadID, ()=>{}, event.messageID);
				return Utils.logModuleErrorToAdmin(msg, module.name, event);
            }
			let lang = module.language[CLIENT.CONFIG.language][values[0]] || '';
            for (var i = values.length; i > 0x16c0 + -0x303 + -0x1f * 0xa3; i--) {
                const expReg = RegExp('%' + i, 'g');
				lang = lang.replace(expReg, values[i]);
			}
			return lang;
        }
    }
    
    Utils.getRemainingTime = function (seconds) {
    	
		const hasS = (pref, count) => {
			return (count > 0) ? (count > 1) ? pref+'s' : pref : '';
		}
		
		seconds = Number(seconds);
		var d = Math.floor(seconds / (3600*24));
		var h = Math.floor(seconds % (3600*24) / 3600);
		var m = Math.floor(seconds % 3600 / 60);
		var s = Math.floor(seconds % 60);
	
		/*if (!v2) { // will send complete countdown details Day -> Seconds
			const sDisplay = s > 0 ? s + hasS('second', s) : '';
			const mDisplay = m > 0 ? m + (m == 1 ? (s > 0) ? ' minute and ' : ' minute' : (s > 0) ? ' minutes and ' : ' minutes') : '';
			const hDisplay = h > 0 ? h + (h == 1 ? (m > 0) ? ((s > 0) ? ' hour, ' : ' hour and ') : ((s > 0) ? ' hour and ' : ' hour') : (m > 0) ? ((s > 0) ? ' hours, ' : ' hours and ') : ((s > 0) ? ' hours and ' : ' hours')) : '';
			const dDisplay = d > 0 ? d + (d == 1 ? (h > 0) ? ((m > 0) ? ' day, ' : ' day and ') : ((h > 0) ? ' day and ' : ' day') : (h > 0) ? ((m > 0) ? ' days, ' : ' days and ') : ((h > 0 ) ? ' days and ' : ' days')) : '';
			return {
				day: d,
				hour: h,
				minute: m,
				second: s,
				toString: dDisplay + hDisplay + mDisplay + sDisplay
			};
		}*/
		
		const allTime = [
			{ val: d, val_text: ((d<10) ? `0${d}` : d), name: 'day' },
			{ val: h, val_text: ((h<10) ? `0${h}` : h), name: 'hour' },
			{ val: m, val_text: ((m<10) ? `0${m}` : m), name: 'minute' },
			{ val: s, val_text: ((s<10) ? `0${s}` : s), name: 'second' }
		];
	
		const result = [];
		for (const item of allTime) {
			if (result.length < 2 && item.val > 0) {
				result[result.length] = `${item.val} ${hasS(item.name, item.val)}`;
			}
		}
		// Out: 3 minutes and 1 second (example)
		return { text: result.join(' and '), values: [ ...allTime ] };
	}
	
	/////////// CANVAS FUNCTIONS /////////
	
	// Wrap a text from a canvas.
	Utils.wrapText = function (ctx, text, maxWidth) {
	
		return new Promise(resolve => {
			if (ctx.measureText(text).width < maxWidth) return resolve([text]);
			if (ctx.measureText('W').width > maxWidth) return resolve(null);
			const words = text.split(' ');
			const lines = [];
			let line = '';
			while (words.length > 0) {
				let split = false;
				while (ctx.measureText(words[0]).width >= maxWidth) {
					const temp = words[0];
					words[0] = temp.slice(0, -1);
					if (split) words[1] = `${temp.slice(-1)}${words[1]}`;
					else {
						split = true;
						words.splice(1, 0, temp.slice(-1));
					}
				}
				if (ctx.measureText(`${line}${words[0]}`).width < maxWidth) line += `${words.shift()} `;
				else {
					lines.push(line.trim());
					line = '';
				}
				if (words.length === 0) lines.push(line.trim());
			}
			return resolve(lines);
		});
	}
	
	// Make the image circle
	Utils.makeCircleImg = async function (image) {
		const jimp = require('jimp');
		const ret_img = await jimp.read(image);
		ret_img.circle();
		return await ret_img.getBufferAsync('image/png');
	}
	
	Utils.makeMusicPanel = function (title, author, pictureLink, resultPath) {
		const canvas = require('canvas');
		
		return new Promise (async (resolved, reject) => {
			await Axios.get(pictureLink, { responseType: 'arraybuffer' }).then(async (result) => {
				try {
					const picturePath = Path.join(CLIENT.CACHE_PATH, `${this.randomString(16)}.png`);
					Filesystem.writeFileSync(picturePath, Buffer.from(result.data, 'utf-8'));
					
					const music_panel = await canvas.loadImage(Path.join(CLIENT.CACHE_PATH, 'keep', 'thumb-musicPlayPanel.png'));
					// # fonts
					canvas.registerFont(Path.join(CLIENT.CACHE_PATH, 'keep/fonts', 'YasashisaGothic.ttf'), { family: 'YG-reg' });
					canvas.registerFont(Path.join(CLIENT.CACHE_PATH, 'keep/fonts', 'YasashisaGothicBold-V2.otf'), { family: 'YG-bold' });
				
					const main_canvas = canvas.createCanvas(music_panel.width, music_panel.height + 20);
					const picture = await canvas.loadImage(picturePath);
					
					const ctx = main_canvas.getContext('2d');
					
					ctx.drawImage(picture, 15, 23, 108, 108);
					ctx.drawImage(music_panel, 0, 0, music_panel.width, music_panel.height);
	
					ctx.fillStyle = '#ffffff';
					
					ctx.font = '32px YG-bold';
					ctx.fillText(title, 151, 65);
	
					ctx.font = '26px YG-reg';
					ctx.fillText(author, 151, 105);
					
					const randomResultPath = resultPath || Path.join(CLIENT.CACHE_PATH, `musicPlayer-${this.randomString(16)}.png`);
					Filesystem.unlinkSync(picturePath);
					Filesystem.writeFileSync(randomResultPath, main_canvas.toBuffer());
					
					const Post = {};
					Post.path = randomResultPath;
					Post.deleteImg = function () {
						try { Filesystem.unlinkSync(randomResultPath); } catch (err) {}
					}
					
					resolved(Post);
				} catch (err) {
					reject(err);
				}
			}).catch(reject);
		});
		
	}
	
	return Utils;
}