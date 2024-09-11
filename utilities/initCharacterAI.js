const Filesystem = require('fs-extra');
const Path = require('path');

const CharacterAI = require('node_characterai');

module.exports.authenticate = async function (root, Logger) {
	
	const characters = Filesystem.readJsonSync(Path.join(root, 'json', '/ref-characterAI.json'));
	const models = { isError: false };
	
	/*
	try {
		const token = process.env.CHARACTERAI_AUTH_TOKEN;
		for (const name in characters) {
			
			Logger(`Character AI » authenticating ${name}...`, 'login');
			
			const charID = characters[name];
			const characterAI = new CharacterAI();
			
			await characterAI.authenticateWithToken(token);
			const chat = await characterAI.createOrContinueChat(charID);
			
			console.dir(chat);
			models[name] = { chat, client: characterAI };
			
		}
	} catch (err) {
		console.error(err);
		models.isError = true;
	}
	*/
	models.isError = true;
	return models
}