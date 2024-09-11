const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.run = async function ({ args, event, API, BOT_INFO, CLIENT, MODULES, prefixUsed, keyWordUsed, Message, Utils, Users, Threads }) {
	
	const { senderID, threadID, messageID, mentions } = event;
	
	const allUsers = await Users.getAll([ 'USERID' ]);
	const allGroups = await Threads.getAll([ 'THREADID' ]);
	
	const time = Math.abs(BOT_INFO.STARTTIME - Date.now());
	const { values } = Utils.getRemainingTime(time/1000);
	
	if (keyWordUsed == 'uptime') {
		const title = await Utils.fancyFont.get('Running', 1);
		const subTitle = await Utils.fancyFont.get(`${values[1].val_text}h : ${values[2].val_text}m : ${values[3].val_text}s`, 1);
		return Message.reply(Utils.textFormat('formats', 'headerNContentThinFormat', title, subTitle));
	}
	
	const runtime = `${values[1].val_text} : ${values[2].val_text} : ${values[3].val_text}`;
	const memory = `${(process.memoryUsage.rss() / 1024 / 1024).toFixed(2)} MB`;
	const cpu = `${(process.cpuUsage().system / 1024 / 1024 ).toFixed(2)} %`;
	const node_cpu = `${(process.cpuUsage().user / 1024 / 1024 ).toFixed(2)} %`;
	
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
		((onDB) ? allUsers.length : '<database offline>'),
		((onDB) ? allGroups.length : '<database offline>'),
		runtime,
		totalEvents,
		totalModules,
		memory,
		cpu,
		node_cpu
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