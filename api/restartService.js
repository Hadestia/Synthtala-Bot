// This will serve as an API to restart all the BOT sessions
exports.name = '/restart-service';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.index = async function (req, res) {
	
	if (!req.query.authKey) {
		return res.status(400).json({ error: 'Missing authentication key'});
	}
	
	const authKey = req.query.authKey;
	
	if (authKey !== process.env.AUTH_KEY) {
		return res.status(401).json({ error: 'Invalid authentication key' });
	} else {
		res.status(200).json({ message: 'Server is now restarting' });
		await sleep(1000);
		process.exit(2);
	}
}