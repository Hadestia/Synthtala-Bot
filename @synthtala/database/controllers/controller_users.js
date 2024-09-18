module.exports = function ({ Models, API, textFormat }) {
	
	const Filesystem = require('fs-extra');
	const Path = require('path');
	const Axios = require('axios');
	
	const Users = Models.use('Users');
	const Ctrl = {};
	
	////// RESET
	Ctrl.resetDatabase = function () {
		return new Promise(async (resolved, rejected) => {
			try {
				await Users.truncate();
				resolved();
			} catch (e) {
				rejected(e);
			}
		});
	}
	
	////// CREATE
	Ctrl.createData = async function ( USERID, defaults ) {
		
		if (typeof defaults != 'object' && !Array.isArray(defaults)) {
			throw new Error('Needs Object');
		}
		
		return new Promise(async ( resolve, reject ) => {
			try {
				const result = await Users.findOrCreate({ where: { USERID }, defaults });
				resolve(result);
			} catch (err) {
				reject(err);
			}
		});
	}
	
	////// CREATE : MANY
	Ctrl.createManyData = async function ( usersObj ) {
		
		if (typeof defaults != 'object' && !Array.isArray(usersObj)) {
			throw new Error('Needs Object');
		}
		
		return new Promise ((resolve, reject) => {
			User.bulkCreate([ ...usersObj ]).then(resolve).catch(reject);
		})

	}
	
	///// UPDATE
	Ctrl.setData = async function ( USERID, options ) {
		
		if (typeof options != 'object' && !Array.isArray(options)) {
			throw new Error('Needs Object');
		}
		
		return new Promise(async (resolve, reject) => {
			try {
				let data = await Users.findOne({ where: { USERID: USERID }});
				if (data) {
					data.update(options);
					resolve({ data, signal: 'Update' });
				} else {
					Ctrl.createData( USERID, options ).then((data) => { resolve({ data, signal: 'Set' }) }).catch(reject);
				}
			} catch (e) {
				reject (e);
			}
		});
	}
	
	///// GET
	Ctrl.getData = async function ( USERID ) {
		
		try {
			const data = await Users.findOne({ where: { USERID: USERID } });
			return (data) ? data.get({ plain: true }) : false;
		} catch (e) {
			console.error(e);
			return false;
		}
	}
	
	///// GET ALL
	Ctrl.getAll = async function ( ...data ) {
		
		let where, attributes;
		if (data.length === 0) {
			throw new Error('Needs Object or Array');
		}
		
		for (const item of data) {
			if (typeof item != 'object') {
				throw new Error('Needs Object or Array');
			}
			if (Array.isArray(item)) {
				attributes = item;
			} else {
				where = item;
			}
		}
		try {
			const datas = (await Users.findAll({ where, attributes })).map(e => e.get({ plain: true }));
			return datas;
		} catch (e) {
			console.error(e);
			return [];
		}
	}
	
	///// DELETE
	Ctrl.deleteData = async function ( USERID ) {
		
		try {
			const data = await Users.findOne({ where: { USERID: USERID } });
			if (!data) { return false; }
			await data.destroy();
			return true;
		} catch (e) {
			console.error(e);
			return false;
		}
		
	}
	
	///////// OTHER FUNCTIONS
	
	Ctrl.getInfo = async function (ID) {
		return await API.getUserInfo(ID).then((result) => {
			if (result[ID]) {
				// make some changes on the result
				const info = result[ID];
				const user_name = (info.vanity && info.vanity.length > 0) ? info.vanity : ID;
				const returnable = {
					id: ID,
					name: (info.firstName) ? info.name : `user${ID}`,
					username: user_name,
					first_name: info.firstName || textFormat.miscs.noDataTxtFont,
					gender: (info.gender) ? ((info.gender == 1) ? 'Female' : (info.gender == 2) ? 'Male' : textFormat.miscs.noDataTxtFont) : textFormat.miscs.noDataTxtFont,
					profileUrl: `www.facebook.com/${user_name}`,
					avatar: Ctrl.getAvatarLink(ID),
					avatar1: info.thumbSrc,
					type: info.type,
					isFriend: info.isFriend || false,
					isBirthday: info.isBirthday || false
				};
				// console.dir(returnable);
				return returnable;
			} else {
				return false;
			}
		}).catch((error) => {
			console.log(error);
			return false;
		});
	}

	Ctrl.getNameUser = async function ( ID ) {
		try {
			const data = (await Ctrl.getData( ID )) || {};
			return data.name || `user${ ID }`;
		} catch (e) {
			return `user${ ID }`;
		}
	}
	
	Ctrl.getAvatarLink = function ( userID ) {
		return `https://graph.facebook.com/${userID}/picture?height=1024&width=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
	}
	
	Ctrl.getAvatar = function (userID, path) {
		const link = Ctrl.getAvatarLink(userID);
		return new Promise((resolve, reject) => {
			Axios.get(link, { responseType: 'arraybuffer' }).then((res) => {
				
				const picturePath = path || Path.join(CLIENT.CACHE_PATH, `avatar-${userID}.png`);
				Filesystem.writeFileSync(picturePath, Buffer.from(res.data, 'utf-8'));
				
				const Post = {};
				Post.path = picturePath;
				Post.stream = Filesystem.createReadStream(picturePath);
				Post.deleteImage = function () {
					try { Filesystem.unlinkSync(picturePath); } catch (err) {}
				}

				resolve(Post);
			}).catch(reject);
		});
	}

	return Ctrl;
}