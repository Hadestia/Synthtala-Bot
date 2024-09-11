module.exports.run = async function ({ args, event, API, CLIENT, Message, Post, Utils, ModuleData, HandleCommandReply, Threads, Users }) {
	
	const { senderID, threadID, messageID, mentions, messageReply } = event;
	
	const mainGroups = CLIENT.CONFIG.mainGroups || [];
	const membersToAdd = []; // @Objects
	const successAddedMembers = []; // @Names
	
	// @MessageReply
	if (event.type === 'message_reply' && messageReply.senderID) {
		const name = await Users.getNameUser(messageReply.senderID);
		membersToAdd.push({
			id: messageReply.senderID,
			name: name
		});
	}
	
	// @Mentions
	if (Object.keys(mentions).length > 0) {
		for (const id in mentions) {
			membersToAdd.push({
				id: id,
				name: mentions[id].replace('@', '')
			});
		}
	}
	
	// @Requester
	if (args.length === 0) {
		membersToAdd.push({
			id: senderID,
			name: 'You'
		});
	}
	
	const sendErr = (msg) => {
		Message.react('error');
		Message.reply(Utils.textFormat('errors', 'errorMsg', msg));
	};
	
	if (mainGroups.length === 0) {
		sendErr('There\'s no main group chat set for this bot.');
	} else {
		if (mainGroups.length === 1) {
			const mainGroupInfo = await Threads.getInfo(mainGroups[0]);
			if (mainGroupInfo) {
				const participants = mainGroupInfo.participantIDs;
				if (participants.length < 250) {
					for (const candidate of membersToAdd) {
						if (participants.includes(candidate.id)) {
							Message.reply(`${(candidate.name === 'You') ? 'You are' : `${candidate.name} is`} already a member of group ${mainGroupInfo.threadName}.`);
						} else {
							await addMember(candidate.id, mainGroupInfo.threadID).then(() => {
								successAddedMembers.push(candidate.name);
							}).catch((err) => {
								Message.reply(Utils.textFormat('errors', 'errorMsg', `Unable to add ${candidate.name} to the group.`));
							});
						}
					}
					
					// Callback
					if (successAddedMembers.length > 0) {
						Message.reply(`${successAddedMembers.join(', ')} were added to ${mainGroupInfo.threadName}.`);
						Message.react('success');
					} else {
						Message.react('error');
					}
				} else {
					sendErr(`${mainGroupInfo.threadName} is currently full.`);
				}
			} else {
				sendErr('Unable to process your request. Try again later');
			}
		} else {
			// TODO: Selection of Group via HandleReply if there's more than one main groups.
		}
	}
}

function addMember(uid, tid, API) {
	return new Promise (async (res, rej) => {
		API.addUserToGroup(uid, tid, (err) => {
			if (err) {
				rej(err);
			} else {
				setTimeout(res, 2000);
			}
		});
	});
}