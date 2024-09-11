module.exports.run = async function({ event, args, API, CLIENT, Message, Utils, ModuleData, Post }) {
	
	const Path = require('path');
	const Axios = require('axios');
	const Filesystem = require('fs-extra');
    
	const { threadID, messageID, senderID } = event;
	
	Message.react('inprogress', messageID);

	let result_amount = 21; // default
	let search_query = args.join(' ');
	
	// has amount result;
	const amount_queries = (search_query.match(/-?\d+/g) || []).map((r) => Number(r*(-1)));
	if (amount_queries.length > 0) {
		const amount = amount_queries[0];
		search_query = search_query.substr(0, search_query.indexOf(`-${amount}`))
		result_amount = (amount > 24) ? 24 : amount;
	}
	
	try {
		// search
		const { data: response } = await Axios.get(
			ModuleData.placeholders.pinterestAPI.replace('${query}', encodeURI(search_query))
		);
		
		if (!response.data) {
			return Message.react('error', messageID);
		}
		
		const results = response.data;
		
		const map = [];
		let random = [], images = [];
		
		for (let i = 0; i < results.length; i++) {
			const url = results[Math.floor(Math.random() * results.length)];
			if (!map.includes(url)) {
				map[map.length] = url;
				random[random.length] = url;
			}
		}
		/// Filter URLs
		result_amount = (result_amount > random.length) ? random.length : result_amount;
		await random.splice(result_amount, random.length - result_amount);
		
		const downloaded = [];
		for (const url of random) {
			const filePath = Path.join(CLIENT.CACHE_PATH, (url.split('/')).pop());
			await Utils.downloadFile(url, filePath).then(() => {
				images[images.length] = Filesystem.createReadStream(filePath);
				downloaded[downloaded.length] = filePath;
			}).catch((e) => {});
		};
		
		return Message.reply(
			{
				body: Utils.textFormat('formats', 'starBulletResult', `${images.length} Images found related to subject.`),
				attachment: images
			},
			(err) => {
				if (!err) {
					Message.react('success', messageID);
				}
				Post.addUserCooldown();
				downloaded.forEach((item) => {
					try { Filesystem.unlinkSync(item); } catch (e) {}
				});
			}
		)
	} catch (err) {
		console.error(err);
		Message.react('error', messageID);
	}
};