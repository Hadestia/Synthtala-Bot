const Path = require('path');
const Filesystem = require('fs-extra');

module.exports.run = async function({ event, args, API, CLIENT, Users, Message, Utils, Post }) {
	
	let { threadID, senderID, messageID } = event;
	
	const inputExpression = new RegExp('.*\|.*');
	const input = args.join(' ');
	
	if (!inputExpression.test(input)) {
		return Post.invalidSyntax();
	}
	
	let [ title, artist ] = input.split('|');
	const image_path = Path.join(CLIENT.CACHE_PATH, `musicPlayer${senderID}.jpg`);
	
	const requesterProfileLink = Users.getAvatarLink(senderID);
	
	title = (title.trim()).normalize('NFKD');
	artist = (artist.trim()).normalize('NFKD');
	
	await Utils.makeMusicPanel(title, artist, requesterProfileLink, image_path).then((Post_img) => {
		Message.reply(
			{ body: '', attachment: Filesystem.createReadStream(Post_img.path) },
			async (err) => {
				Filesystem.unlinkSync(Post_img.path)
				if (err) {
					Message.react('error', messageID);
				} else {
					await Post.addUserCooldown();
					Message.react('success', messageID);
				}
			}
		);
	}).catch((err) => {
		console.error(err);
		Message.react('error', messageID);
		Message.reply(Utils.textFormat('errors', 'errorMsg', 'Unable to process your request, try again later'));
	});
}