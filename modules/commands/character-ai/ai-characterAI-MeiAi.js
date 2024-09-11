module.exports.run = async function ({ args, event, Message, Utils, Post, Logger, ModuleData, CharacterAI, CLIENT }) {
	
	const { threadID, messageID, senderID } = event;
	
	if (CharacterAI.isError) {
		Message.reply(
			Utils.textFormat('errors', 'errorMsg', `Character AI was currently facing some trouble and cannot be processed your request right now.`)
		);
		return Message.react('error');
	}
	
	const init_prompt = args.join(' ');
	Message.react('inprogress');
	
	const prompt = `(OOC - This message was sent by userID[${senderID}] - context are multiple people are chatting you to chat in a chatroom using your API, do not address them using their userID)\n\n${init_prompt}`;
	try {
		await Promise.race([
			(CharacterAI.MeiAi.chat.sendAndAwaitResponse(prompt, true)),
			(new Promise((_, rej) => setTimeout(() => rej(`${ModuleData.id} Request Timeout.`), 60000)))
		]).then((response) => {
			//console.dir(response);
			const reply = response.text;
			Message.reply(
				reply,
				async (err) => {
					if (err) {
						return Message.react('error');
					}
					Message.react('success');
					//await Post.addUserCooldown();
				}
			);
		}).catch((err) => {
			console.error(err);
			Message.react('error');
			Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
		});
	} catch (err) {
		console.error(err);
		Message.react('error');
		//Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
	}
}