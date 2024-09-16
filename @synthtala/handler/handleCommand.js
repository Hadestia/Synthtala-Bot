const Filesystem = require('fs-extra');
const Path = require('path');

module.exports = function ({ CLIENT, BOT_INFO, Bans, Users, Threads, Commands, Utils, Logger }) {
	
	const moment = require('moment-timezone');
	const stringSimilarity = require('string-similarity');
	

	const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const databaseReference = Filesystem.readJsonSync(`${CLIENT.ROOT_PATH}/json/ref-defaultDatabase.json`);

	const Handler = {};
	
	Handler.listen = async function ({ event, API, CLIENT, MODULES, Message, HandleCommandReply, CharacterAI }) {
			
		const timeExecuted = moment.tz('Asia/Manila').format('DD/MM/YYYY - HH:MM:ss');
		let { body, mentions, senderID, threadID, messageID, isGroup } = event;
			
		const UserData = await Users.getData(senderID);
		const GroupData = await Threads.getData(threadID);
		
		const UserBanData = await Bans.getData(senderID);
		const GroupBanData = await Bans.getData(threadID);
			
		let groupInfo = (GroupData) ? GroupData.threadInfo : databaseReference.group_db.threadInfo;
		let groupSettings = (GroupData) ? GroupData.settings : databaseReference.group_db.settings;
		let groupData = (GroupData) ? GroupData.data : databaseReference.group_db.data;
			
		const bot_mention_prefix = (mentions && Object.keys(mentions).length > 0 && Object.keys(mentions)[0] == BOT_INFO.ID) ? true : false;
		const bot_was_mentioned_name = (bot_mention_prefix) ? (Object.values(mentions)[0]).replace('@', '') : BOT_INFO.ID;
		const prefix_used = (groupSettings.hasOwnProperty('bot-prefix')) ? groupSettings['bot-prefix'] : CLIENT.CONFIG.defaultPrefix;
		//const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(prefix_used)})\\s*`);
		const prefixRegex = new RegExp(`^(<@!?${senderID}>|\@${bot_was_mentioned_name}|${escapeRegex(prefix_used)})\\s*`);
		
		// @Ordinary Message
		if (!prefixRegex.test(body)) {
			// @Finding prefix
			if (body.toLowerCase() === 'prefix') {
				showHelpContents ({ event, arguments: [ 'usage' ], prefix_used, API, BOT_INFO, CLIENT, MODULES, Message, Utils, Users });
			}
			return;
		}
		
		const white_listed_ids = [ ...CLIENT.CONFIG.botOwners, ...CLIENT.CONFIG.botAdmins ];
		const group_ban = await Bans.getData(threadID);
		const user_ban = await Bans.getData(senderID);
			
		// Maintenance?
    	if (CLIENT.CONFIG.isMaintenance && !white_listed_ids.includes(senderID)) {
    		return Message.reply(Utils.textFormat('system', 'underMaintenance'));
		}
		
		// Private message restrictions
		if (!isGroup && !CLIENT.CONFIG.allowPrivateMessage && !white_listed_ids.includes(senderID)) {
			return Message.reply(Utils.textFormat('system', 'offPrivateMessage'));
		}
			
		if (group_ban || user_ban) {
			if (!white_listed_ids.includes(senderID)) {
				if (group_ban) {
					const { reason, dateIssued } = group_ban.data;
					return Message.reply(Utils.textFormat('events', 'groupBannedFromBot', dateIssued, reason));
				}
				if (user_ban) {
					const { reason, dateIssued } = user_ban.data;
					/// get rid of 'other bot' ban message spam
					if (reason.toLowerCase().indexOf('other bot') !== -1) {
						return;
					}
					return Message.reply(Utils.textFormat('events', 'userBannedFromBot', dateIssued, reason));
				}
			}
		}
			
		// Delete bot id in mentions if the user mentioned this bot as a command prefix
		if (Object.keys(mentions).length >= 1 && bot_mention_prefix) {
			delete event.mentions[BOT_INFO.ID];
		}
			
		const [ matchedprefix_used ] = body.match(prefixRegex);
		const userWholeInput = body.slice(matchedprefix_used.length).trim();
		const arguments = userWholeInput.split(/\s+/);
			
		// If bot was poked using prefix
		if (arguments[0] == '') {
			return Message.react('question'); // Message.reply(Utils.textFormat('system', 'botPoked', prefix_used));
		}
		
			
		// Get the command that was typed after the prefix
		const commandTyped = ((arguments.length > 1 && arguments[0] === '') ? arguments[1] : arguments.shift()).toLowerCase();
			
		if (commandTyped == 'help') {
			showHelpContents ({ event, arguments, prefix_used, API, BOT_INFO, CLIENT, MODULES, Message, Utils, Users });
			return;
		}
			
		// Get Command Script:
		let commandTargetID = (MODULES.cmd_aliases[commandTyped]) ? MODULES.cmd_aliases[commandTyped] : (MODULES.cmd_names[commandTyped]) ? MODULES.cmd_names[commandTyped] : false;
			
		// Command not found
		if (!commandTargetID) {
			Message.react('question');
			/* API.sendMessage(
				`Unfound Command: ${commandTyped}`, //Utils.textFormat('system', 'unfoundCommand'),
				threadID,
				Utils.autoUnsend,
				messageID
			);
			*/
			return;
		}
			
		const time_initiated = Date.now();
		const absoluteUserArgInput = userWholeInput.slice(commandTyped.length).trim();
		const module = MODULES.commands[commandTargetID];
		const moduleData = module.moduleData;
			
		// Command parsing for Groups
		if (event.isGroup) {
			if (moduleData.needGroupData && !GroupData) {
				// Lets assume group data for this thread was still initializing
				// Maybe react on that prompt with an emoji
				
			}
		// How about for User only
		} else {
			if (moduleData.groupCommandOnly) {
				return Message.reply(Utils.textFormat('commands', 'cmdGroupCmdOnly'), Utils.autoUnsend);
			}
		}
			
		// If this group was banned for this command // Of course white listed people are exempted
		if (!white_listed_ids.includes(senderID)) {
			if (groupData.bannedCommands.includes(commandTargetID)) {
				return Message.reply(Utils.textFormat('commands', 'groupBannedCmd', commandTyped), Utils.autoUnsend);
			}
			
			if (groupData.bannedUsers.includes(senderID)) {
				return Message.reply(Utils.textFormat('commands', 'userBannedCmd', commandTyped), Utils.autoUnsend);
			}
		}
			
		if (UserBanData) {
			const data = UserBanData.data;
			return Message.reply(Utils.textFormat('commands', 'bannedUserUsedCmd', data.dateIssued, data.reason), Utils.autoUnsend);
		}
			
		if (GroupBanData) {
			const data = GroupBanData.data;
			return Message.reply(Utils.textFormat('commands', 'bannedGroupUsedCmd', data.dateIssued, data.reason), Utils.autoUnsend);
		}
				
		// Handle NSFW command
		if ((moduleData.isNSFW || moduleData.category == 'nsfw') && !groupSettings['allow-nsfw'] && !white_listed_ids.includes(senderID)) {
			return Message.reply(Utils.textFormat('commands', 'cmdNsfwNotAllowed'), Utils.autoUnsend);
		}
				
		// Handle command Permission
		// -1 - Bot Owners
		//  0 - Everyone
		//  1 - Group Admins
		//  2 - Bot Admins
		const commandPermission = moduleData.permission;
		const isBotAdmin = CLIENT.CONFIG.botAdmins.includes(senderID);
		const isBotOwner = CLIENT.CONFIG.botOwners.includes(senderID);
		const isGroupAdmin = (event.isGroup) ? groupInfo.adminIDs.includes(senderID) : false;
				
		let isEligible = false

		switch (commandPermission) {
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
				
		// If not eligible
		if (!isEligible && !isBotOwner) {
			return Message.reply(Utils.textFormat('commands', 'cmdPermissionDeclined', Utils.textFormat('command_permissions', `cmdPerm${commandPermission}`)), Utils.autoUnsend);
		}
				
		if (moduleData.requiredArgument && moduleData.requiredArgument > arguments.length) {
			return Message.reply(Utils.textFormat('commands', 'cmdInvalidSyntax', `${prefix_used}${commandTyped} ${moduleData.usage}`));
		}
				
		// Handle User Cooldowns
		let commandData = await Commands.getData(moduleData.id) || { ID: moduleData.id, data: moduleData, cooldowns: {} };
		if (!isBotOwner) {
			const commandTimeLength = (moduleData.cooldown || 0) * 1000;
			const userLastUsed = commandData.cooldowns[senderID] || 0;
			const userCooldown = userLastUsed + commandTimeLength;
				
			if (Date.now() < userCooldown) {
				const remainingTime = Utils.getRemainingTime(Math.abs(userCooldown - Date.now())/1000);
				return Message.reply(Utils.textFormat('commands', 'cmdUserInCooldown', remainingTime.text), Utils.autoUnsend);
			}
		}
				
		const Post = {};
		Post.addUserCooldown = async function () {
			if ((moduleData.cooldown || 0) !== 0 && !isBotOwner) {
				commandData.cooldowns[senderID] = Date.now();
				await Commands.setData(moduleData.id, commandData ).then((obj) => {
					Logger(`Command ${commandTargetID} ${obj.signal} Data For User-${senderID}.`, 'module');
				}).catch((err) => {
					console.error(err);
					Logger.makeLog(CLIENT.LOG_PATH, err, 'module');
				});
			}
		}
		Post.invalidSyntax = function (customMsg) {
			return Message.reply(customMsg || Utils.textFormat('commands', 'cmdInvalidSyntax', `${prefix_used}${moduleData.name} ${moduleData.usage}`));
		}
		Post.logModuleError = function (error) {
			Logger.makeLog(CLIENT.LOG_PATH, `${moduleData.id} Occurred An Error:`, 'module');
			Logger.makeLog(CLIENT.LOG_PATH, error, 'module');
		}
			
		/// Prepare to execute command
		const Inputs = { API, CLIENT, BOT_INFO, MODULES, Message, Post, Utils, Bans, Users, Threads, Commands, Logger };
		Inputs.ModuleData = moduleData;
		Inputs.args = arguments;
		Inputs.body = absoluteUserArgInput;
		Inputs.event = event;
		Inputs.textFormat = Utils.textformat;
		Inputs.getText = Utils.getModuleText(moduleData, event);
		Inputs.keyWordUsed = commandTyped; // name of the command or alias used to execute the command
		Inputs.prefixUsed = prefix_used; // e.g "/", group prefix, by mentioning
		
		Inputs.CharacterAI = CharacterAI;
		Inputs.HandleCommandReply = HandleCommandReply;
		
		const moduleScript = require(module.moduleScriptPath);
		// Execute
		try {
			//const ping = Math.abs(time_initiated - Date.now());
			if (moduleScript.run && typeof(moduleScript.run) === 'function') {
				if (moduleScript.run.constructor.name === 'AsyncFunction') {
					await moduleScript.run(Inputs, time_initiated);
				} else {
					moduleScript.run(Inputs, time_initiated);
				}
			}
			return;
		} catch (err) {
			console.error(err);
			Logger.makeLog(CLIENT.LOG_PATH, err, 'module');
		}
	}
	
	return Handler;
}

async function showHelpContents ({ event, arguments, prefix_used, API, BOT_INFO, CLIENT, MODULES, Utils, Users, Message }) {
	
	const cmdCategoriesReference = CLIENT.COMMAND_CATEGORY_REF;
	
	let banners = [], chosenBannerPath;
	const responseDecor = (['img', 'gif'].includes(CLIENT.CONFIG.helpCommandDecor));
	const decorType = CLIENT.CONFIG.helpCommandDecor;
	
	if (responseDecor) {
		if (decorType === 'img') {
			banners = Filesystem.readdirSync(Path.join(CLIENT.CACHE_PATH, 'keep', 'banners')).filter((file) => file.endsWith('.png'));
		} else {
			banners = Filesystem.readdirSync(Path.join(CLIENT.CACHE_PATH, 'keep', 'banners')).filter((file) => file.endsWith('.gif'));
		}
		chosenBannerPath = Path.join(CLIENT.CACHE_PATH, 'keep', 'banners', banners[Math.floor(Math.random() * banners.length)]);
	}
	
	const { threadID, messageID } = event;
	// Command Name Or Category Name
	const req_name = (arguments.join('-').trim() || '').toLowerCase();
	
	const autoUnsend = async function (err, info) {
		if (err) return;
		await new Promise(resolve => setTimeout(resolve, 300 * 1000));
		return Message.unsend(info.messageID);
	}
	
	// Help for Usages ?
	if (req_name === 'usage' || req_name === 'usages') {
		return Message.reply(Utils.textFormat('command_help', 'commandHelpUsage', prefix_used, BOT_INFO.FULLNAME ));
	}
	
	// /Help all or /Help <page> ??
	let requestPage = parseInt(req_name) || false;
	if (requestPage || req_name === 'all') {
		
		const cmdData = {};
		const arrayInfo = [];
		const itemPerPage = 15;
        let index = 0;
        
		for (const cmdID in MODULES.commands) {
			const content = MODULES.commands[cmdID];
			const moduleData = content.moduleData;
			if (!moduleData.hidden) { // Filter hidden commands
				arrayInfo.push(moduleData.name);
				cmdData[moduleData.name] = moduleData;
			}
		}
		arrayInfo.sort((a, b) => { return (a > b) ? 1 : -1 });
		
		requestPage = parseInt(req_name) || 1;
		const totalPages = Math.ceil(arrayInfo.length/itemPerPage);
		const page = (requestPage > totalPages) ? 1 : requestPage;
		const pageSlice = itemPerPage * page - itemPerPage;
		const returnArray = arrayInfo.slice(pageSlice, pageSlice + itemPerPage);
		
		let messageListBody = '';
		index = pageSlice;
        
		for (let cmd_name of returnArray) {
			index += 1;
			const fontedName = await Utils.fancyFont.get(cmd_name, 6);
			messageListBody += '' + Utils.textFormat('command_help', 'cmdListCmd', prefix_used, fontedName) + '\n';
		}
		const messageBody = Utils.textFormat('command_help', 'cmdAllListFormat', page, totalPages, messageListBody, prefix_used);
		
		return Message.reply(
			{
				body: messageBody,
				attachment: (responseDecor && Boolean(banners.length)) ? Filesystem.createReadStream(chosenBannerPath) : null
			}
		);
	}
	
	// Request via Command Category
	if (cmdCategoriesReference[req_name]) {
		const categoryCommands = [];
		for (const cmdID in MODULES.commands) {
			const cmd = MODULES.commands[cmdID].moduleData;
			if (cmd.category.toLowerCase() == req_name) {
				const name = await Utils.fancyFont.get(`${prefix_used}${cmd.name}`, 6);
				const description = ((cmd.description || '<no description>').split('\n')).shift();
				categoryCommands[categoryCommands.length] = {
					name: (cmd.disabled) ? `${name} [${await Utils.fancyFont.get('disabled', 1)}]` : name,
					desc: (description.length > 73) ? `${description.slice(0, 73)}...` : description,
					aliases: cmd.aliases || []
				}
			}
		}
			
		categoryCommands.sort((a, b) => {
			return (a.name > b.name) ? 1 : -1;
		});
			
		let msgBodyList = '';
		for (const item of categoryCommands) {
			const alias = (item.aliases.length > 0) ? `[ ${ await item.aliases.join(', ')} ]` : 'none';
			msgBodyList = msgBodyList + (Utils.textFormat('command_help', 'cmdListCatCmd', item.name, item.desc, alias)) + '\n\n';
		}
			
		if (categoryCommands.length == 0) {
			msgBodyList = '\n𝙽𝚘 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜\n';
		}
			
		const categoryItem = cmdCategoriesReference[req_name];
		const catName = await Utils.fancyFont.get(`${categoryItem.icon} ${(req_name.charAt(0).toUpperCase() + req_name.slice(1)).replace('-', ' ')}`, 1);
		
		return Message.reply(
			{
				body: Utils.textFormat('command_help', 'cmdCatCommandsFormat', catName, msgBodyList, prefix_used),
				attachment: (responseDecor && Boolean(banners.length)) ? Filesystem.createReadStream(chosenBannerPath) : null
			}
		);
	}
	
	// Request help om particular command
	const commandID = (MODULES.cmd_aliases[req_name]) ? MODULES.cmd_aliases[req_name] : (MODULES.cmd_names[req_name]) ? MODULES.cmd_names[req_name] : false;
	if (commandID) {
		const commandData = MODULES.commands[commandID].moduleData;
		
		const commandName = await Utils.fancyFont.get(commandData.name, 1);
		const commandStatus = commandData.disabled ? 'Disabled' : 'Available';

		const permission = Utils.textFormat('command_permissions', `cmdPerm${commandData.permission || 0}`);
		const commandUsage = `${prefix_used}${commandData.name} ${commandData.usage || ''}`;
		
		const cooldown = (commandData.cooldown && commandData.cooldown > 1) ? `${commandData.cooldown} seconds` : 'no cooldown';
		const commandReplyUsage = (commandData.replyUsage && commandData.replyUsage !== '') ? commandData.replyUsage : false;
		const commandAliases = (commandData.aliases) ? `[ ${commandData.aliases.join(', ')} ]` : 'none';
		
		const messageBody = (commandReplyUsage) ? Utils.textFormat('command_help', 'cmdInfoWithReplyUsage', 
			`${prefix_used}${commandName}`,
			(commandData.description).replace(/\{cmd-name\}/g, commandName).replace(/\{cmd-prefix\}/g, prefix_used),
			commandStatus,
			commandUsage,
			commandReplyUsage,
			commandData.category.replace('-', ' '),
			cooldown,
			permission,
			commandAliases,
			commandData.author || '---'
		) : Utils.textFormat('command_help', 'cmdInfoDefault', 
			`${prefix_used}${commandName}`,
			(commandData.description).replace(/\{cmd-name\}/g, commandName),
			commandStatus,
			commandUsage,
			commandData.category.replace('-', ' '),
			cooldown,
			permission,
			commandAliases,
			commandData.author || '---'
		);
			
		return Message.reply( messageBody ); //, autoUnsend);
	}
	
	// User just typed "help" only?
	if (arguments.length == 0) {
		// Display all CATEGORIES and category description
		let msgBody = '';
		
		for (const catName in cmdCategoriesReference) {
			if (catName !== 'hidden' && catName !== 'nsfw' && catName !== 'event-listener') {
				const data = cmdCategoriesReference[catName];
				if (!data.hide) {
					const categoryName = await Utils.fancyFont.get((catName.charAt(0).toUpperCase() + catName.slice(1)).replace('-', ' '), 1);
					msgBody += '' + Utils.textFormat('command_help', 'cmdListCategory', data.icon, categoryName, data.description ) + '\n\n';
				}
			}
		}
		
		return Message.reply(
			{
				body: Utils.textFormat('command_help', 'cmdListCategoryFormat', msgBody, prefix_used),
				attachment: (responseDecor && Boolean(banners.length)) ? Filesystem.createReadStream(chosenBannerPath) : null
			}
		);
	}
	
	return Message.react('error', messageID);
};