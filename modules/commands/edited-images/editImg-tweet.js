module.exports.run = function({ event, args, API, CLIENT, Message, Users, Utils, Post }) {
	
	let { threadID, senderID, messageID } = event;
	const { loadImage, createCanvas } = require('canvas');
	const Filesystem = require('fs-extra');
	const Axios = require('axios')
	
	Message.react('inprogress', messageID);
	var text = (args.join(' ')).normalize('NFKD');
	
	// Get Avatar 
	Users.getAvatar(senderID, `${CLIENT.CACHE_PATH}/tweet-avt${senderID}.png`).then(async (Post_Img) => {
		
		let pathImg = `${CLIENT.CACHE_PATH}/tweet-${senderID}.png`;
		
		const username = (await Users.getNameUser(senderID)).normalize('NFKD'); 
		
		let getTweet = (await Axios.get(`https://i.imgur.com/V5cbRti.png`, { responseType: 'arraybuffer' })).data;
		Filesystem.writeFileSync(pathImg, Buffer.from(getTweet, 'utf-8'));
	
		let oms = await Utils.makeCircleImg(Post_Img.path);
		let image = await loadImage(oms);
		let baseImage = await loadImage(pathImg);
		let canvas = createCanvas(baseImage.width, baseImage.height);
		let ctx = canvas.getContext('2d');
	
		ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
		ctx.drawImage(image, 53, 35, 85, 85);
		ctx.font = '700 23px Arial';
		ctx.fillStyle = '#000000';
		ctx.textAlign = 'start';
		ctx.fillText(username, 160, 70);
		ctx.font = '400 18px Arial';
		ctx.fillStyle = '#85888f';
		ctx.textAlign = 'start';
		// remove space and vowels to make it more realistic username;
		ctx.fillText(`@${(Math.random() <= 0.5) ? '_' : ''}${((username).toLowerCase()).replace(/\s+|a|e|i|o|u/g, '')}`, 160, 95);
		ctx.font = '400 45px Arial';
		ctx.fillStyle = '#171717';
		ctx.textAlign = 'start';
	
		let fontSize = 250;
		while (ctx.measureText(text).width > 2600) {
			fontSize--;
			ctx.font = `500 ${fontSize}px Arial`;
		}
	
		const lines = await Utils.wrapText(ctx, text, 850);
		let final_text = lines.join('\n');
	
		// Remove exceeding characters.
		final_text = final_text.length > 70 ? final_text.slice(0, 70 - 3) + '...' : final_text;
	
		ctx.fillText(final_text, 56, 180);
		ctx.beginPath();
	
		const imageBuffer = canvas.toBuffer();
	
		Filesystem.writeFileSync(pathImg, imageBuffer);
		Post_Img.deleteImage();
	
		Message.reply(
			{ attachment: Filesystem.createReadStream(pathImg) },
			async (e) => {
				try { Filesystem.unlinkSync(pathImg); } catch(e) {}
				if (!e) {
					await Post.addUserCooldown();
					return Message.react('success', messageID);
				}
				return Message.react('error', messageID);
			},
		);
	}).catch((e) => {
		console.error(e);
		Message.react('error', messageID);
	});
}