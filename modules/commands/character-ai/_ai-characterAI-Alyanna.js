const Axios = require('axios');
const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.run = async function ({ args, event, Message, Utils, Post, Logger, ModuleData, CharacterAI, CLIENT }) {
	
	const { threadID, messageID, senderID } = event;
	
	if (CharacterAI.isError) {
		Message.reply(
			Utils.textFormat('errors', 'errorMsg', `Character AI was currently facing some trouble and cannot be processed your request right now.`)
		);
		return Message.react('error');
	}
	
	Message.react('inprogress');
	
	const attachment = [];
	let prompt;
	
	const reply = (response, path) => {
		const body = response.text;
		Message.reply(
			{ body, attachment },
			async (err) => {
				if (err) {
					return Message.react('error');
				}
				Message.react('success');
				(path) ? Filesystem.unlinkSync(path) : '';
			}
		);
	}
	
	const handleErr = (err) => {
		Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
		console.error(err);
		Message.react('error');
	}
	
	if (promptAskingGraphics(args.join(' '))) {
		try {
			await Promise.race([
				(CharacterAI.AlyannaRoom.chat.generateImage(args.join(' '))),
				(new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 15000)))
			]).then(async (result) => {
				if (result) {
					console.log(result);
					const path = Path.join(CLIENT.CACHE_PATH, `genImage-${Date.now()}-${messageID}.jpg`);
					const token = CharacterAI.AlyannaRoom.client.getToken();
					await Axios.get(
						{
							url: result,
							method: 'GET',
							responseType: 'arrayBuffer',
							headers: {
								'Authorization': `Bearer ${token}`,
								'Content-Type': 'application/json'
							}
						}
					).then((response) => {
						Filesystem.writeFileSync(path, Buffer.from(response.data, 'utf-8'));
						attachment[0] = Filesystem.createReadStream(path);
						reply({ text: '' }, path);
					}).catch((err) => {
						Logger.makeLog(CLIENT.LOG_PATH, `${ModuleData.id}: Unable to download image from the request with ${err}`, 'warn');
						console.error(err);
						Message.react('error');
					});
				}
			}).catch((err) => {
				Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
				console.error(err);
			});
		} catch (err) { handleErr(err); }
	} else {
		const awareness = `(This message was sent by userID(${senderID}) - context are multiple people are chatting you to chat in a chatroom using your API, do not address them using their userID and do not include this when you replied, Most importantly, do not treat other users as a single person.)\n`;
		prompt = `${awareness}\n${args.join(' ')}`;
		try {
			await Promise.race([
				(CharacterAI.AlyannaRoom.chat.sendAndAwaitResponse(prompt, true)),
				(new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 60000)))
			]).then(reply).catch(handleErr);
		} catch (err) { handleErr(err); }
	}
}

// Ability to reply directly on Direct Messages without prefixes
module.exports.handleEvent = async function ({ event, API, BOT_INFO, CLIENT, Utils, ModuleData, Message, Logger, HandleCommandReply, CharacterAI }) {

	// Run if this was call inside direct messages
	if (!CharacterAI.isError && !event.isGroup) {
		
		const { body, attachments, senderID, threadID } = event;
		const ooc = ModuleData.ooc || {};
		
		let Character, prompt;
		let attachment = [];
		
		if (attachments.length > 0) {
			return Message.react('error');
		}
		
		Message.react('inprogress');
		
		const reply = (response) => {
			const reply = response.text;
			Message.reply(
				{ body: reply, attachment },
				async (err) => {
					if (err) {
						return Message.react('error');
					}
					Message.react('success');
					//await Post.addUserCooldown();
				}
			);
		}
	
		const handleErr = (err) => {
			console.error(err);
			Message.react('error');
			Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
		}
		
		// Owners has different Character HEHEHE
		if (CLIENT.CONFIG.botOwners.includes(senderID)) {
			const customPromptPerUser = ooc[senderID] || '';
			prompt = `${customPromptPerUser}\nuserID(${senderID}): ${body}`;
			Character = CharacterAI.Alyanna;
		} else {
			const awareness = `(This message was sent by userID(${senderID}) - context are multiple people are chatting you to chat in a chatroom using your API, do not address them using their userID and do not include this when you replied, Most importantly, do not treat other users as a single person.)\n\n`
			prompt = `${awareness}${body}`;
			Character = CharacterAI.AlyannaRoom;
		}
		
		if (promptAskingGraphics(body)) {
			try {
				await Promise.race([
					(Character.chat.generateImage(body)),
					(new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 15000)))
				]).then(async (result) => {
					if (result) {
						console.log(result);
						const path = Path.join(CLIENT.CACHE_PATH, `genImage-${Date.now()}-${messageID}.jpg`);
						const token = Character.client.getToken();
						await Axios.get(
							{
								url: result,
								method: 'GET',
								responseType: 'arrayBuffer',
								headers: {
									'Authorization': `Bearer ${token}`,
									'Content-Type': 'application/json'
								}
							}
						).then((response) => {
							Filesystem.writeFileSync(path, Buffer.from(response.data, 'utf-8'));
							attachment[0] = Filesystem.createReadStream(path);
							reply({ text: '' }, path);
						}).catch((err) => {
							Logger.makeLog(CLIENT.LOG_PATH, `${ModuleData.id}: Unable to download image from the request with ${err}`, 'warn');
							console.error(err);
							Message.react('error');
						});
					}
				}).catch((err) => {
					Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
					console.error(err);
				});
			} catch (err) { handleErr(err); }
		} else {
			try {
				await Promise.race([
					(Character.chat.sendAndAwaitResponse(prompt, true)),
					(new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 60000)))
				]).then(reply).catch(handleErr);
			} catch (err) { handleErr(err); }
		}
	}
}

function promptAskingGraphics(prompt) {
	const regex = new RegExp(/(create|make|generate|show)+(\s+|\w+)+(image|picture|graphic|photo)/gm);
	return regex.test(prompt.toLowerCase());
}