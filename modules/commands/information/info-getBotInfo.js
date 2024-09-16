const os = require('os');
const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.run = async function ({ args, event, API, BOT_INFO, CLIENT, MODULES, prefixUsed, keyWordUsed, Message, Utils, Users, Threads }) {
	
	const { senderID, threadID, messageID, mentions } = event;
	
	const allUsers = await Users.getAll([ 'USERID' ]);
	const allGroups = await Threads.getAll([ 'THREADID' ]);
	
	// Runtime
	const runtime = process.uptime() - BOT_INFO.STARTTIME;
	const formattedRuntime = formatRuntime(runtime);
	
	// Memory
	const memoryUsage = Utils.getProcessMemoryUsage(process);
	const serverMemory = getMemory();
	
	if (keyWordUsed == 'uptime') {
		const title = await Utils.fancyFont.get('Running', 1);
		const subTitle = await Utils.fancyFont.get(formattedRuntime, 1);
		return Message.reply(Utils.textFormat('formats', 'headerNContentThinFormat', title, subTitle));
	}
	
	// Modules
	const totalModules = Object.keys(MODULES.commands).length;
	const totalEvents = Object.keys(MODULES.events).length;
	
	const onDB = CLIENT.CONFIG.database;
	
	let owner_list = '';
	let admin_list = '';
	
	/*
	for (const id of CLIENT.CONFIG.botOwners) {
		const user_name = await Users.getNameUser(id);
		owner_list += `⤷ ${user_name}\n`;
	}
	for (const id of CLIENT.CONFIG.botAdmins) {
		const user_name = await Users.getNameUser(id);
		admin_list += `⤷ ${user_name}\n`;
	}
	*/
	
	const body = Utils.textFormat('formats', 'botInfoFormat',
		prefixUsed,
		BOT_INFO.FULLNAME,
		BOT_INFO.ID,
		totalEvents,
		totalModules
		((onDB) ? allUsers.length : '<database offline>'),
		((onDB) ? allGroups.length : '<database offline>'),
		formattedRuntime,
		memoryUsage.rss,
		serverMemory.totalMem,
		serverMemory.usedMem,
		serverMemory.availableStorage
		//BOT_INFO.APPSTATE_NAME,
		//((onDB) ? BOT_INFO.DATABASE_NAME : '<database offline>'),
		//owner_list,
		//admin_list
	);
	
	const botName = Utils.removeNonASCII(BOT_INFO.FULLNAME);
	const musicPlayerPath = Path.join(CLIENT.CACHE_PATH, `musicPlayer${BOT_INFO.ID}.png`);
	if (Filesystem.existsSync(musicPlayerPath)) {
		Message.reply(
			{ body, attachment: Filesystem.createReadStream(musicPlayerPath) }
		);
	} else {
		await Utils.makeMusicPanel(botName, 'Powered by Nasmerah', BOT_INFO.AVATAR_LINK, musicPlayerPath).then((Post_img) => {
			Message.reply(
				{ body, attachment: Filesystem.createReadStream(Post_img.path) }
			);
		}).catch((err) => {
			Message.reply(body);
		});
	}
}

function getMemory() {
	
	const totalMemory = os.totalmem();
	const freeMemory = os.freemem();
	const usedMemory = totalMemory - freeMemory;
	
	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} bytes`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		const index = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes/Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
	}
	
	return {
		totalMem: formatBytes(totalMemory),
		freeMem: formatBytes(freeMemory),
		usedMem: formatBytes(usedMemory),
		availableStorage: formatBytes(totalMemory - usedMemory)
	};
}

function formatRuntime(runtime) {
	const hrs = Math.floor(runtime / 3600);
	const mins = Math.floor((runtime % 3600) / 60);
	const secs = Math.floor(runtime % 60);
	return `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
}