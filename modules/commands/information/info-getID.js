module.exports.run = async function({ event, args, API, keyWordUsed, Message, Utils, Post }) {
	
	const { threadID,  messageID, senderID, mentions, body } = event;
	
	const msg_cb = (err) => {
		if (!err) { Post.addUserCooldown(); }
	}
	
	async function searchPerson(str) {
		const search = await API.getUserID(str);
		if (search[0]) {
			return search[0].userID;
		} else {
			return 'I couldn\'t find that person.';
		}
	}
	
	if ([ 'group-id', 'tid' ].includes(keyWordUsed)) {
		return Message.reply(threadID, msg_cb);
	}
	
	// handle reply event
	if (event.type == 'message_reply') {
		return Message.reply(event.messageReply.senderID, msg_cb);
	}
	
	// handle Normal execution
	const mentionLength = Object.keys(mentions).length;
	if (mentionLength == 0) {
		const param = (args[0] || '').toLowerCase();
		if (param.indexOf('facebook.com/') !== -1) {
			const split = param.split('facebook.com/');
			const username = split.pop();
			
			if (parseInt(username)) {
				return Message.reply(`${username}`, msg_cb);
			} else {
				const result = await searchPerson(username);
				return Message.reply(`${result}`, msg_cb);
			}
		} else {
			return Message.reply(`${event.senderID}`, msg_cb);
		}
	// handle mentions
	} else {
		
		let messageListBody = '';
		if (Object.keys(mentions).length > 1) {
		
			for (let i = 0; i < Object.keys(mentions).length; i++) {
				const name = Object.values(mentions)[i].replace('@', '');
				const id = Object.keys(mentions)[i];
				const body = Utils.textFormat('formats', 'getIdMentions', name, id);
				messageListBody = messageListBody + body + '\n';
			}
		
			let messageBody = Utils.textFormat('formats', 'getIdMentionsFormat', messageListBody);
			return Message.reply(messageBody, msg_cb);
			
		} else {
			
			const name = Object.values(mentions)[0].replace('@', '');
			const id = Object.keys(mentions)[0];
			return Message.reply(id, msg_cb);
			
		}
	}
}