module.exports = function ({ Models, API }) {
	
	const Commands = Models.use('Commands');
	const Ctrl = {};
	
	////// RESET
	Ctrl.resetDatabase = function () {
		return new Promise(async (resolved, rejected) => {
			try {
				await Commands.truncate();
				resolved();
			} catch (e) {
				rejected(e);
			}
		});
	}
	
	////// CREATE
	Ctrl.createData = async function ( ID, defaults = {} ) {
		
		if (typeof defaults != 'object' && !Array.isArray(defaults)) {
			throw new Error('Needs Object');
		}
		
		return new Promise(async ( resolve, reject ) => {
			try {
				const result = await Commands.findOrCreate({ where: { ID }, defaults });
				resolve(result);
			} catch (err) {
				reject(err);
			}
		});
	}
	
	///// UPDATE
	Ctrl.setData = async function ( ID, options = {}) {
		
		if (typeof options != 'object' && !Array.isArray(options)) {
			throw new Error('Needs Object');
		}
		
		return new Promise(async (resolve, reject) => {
			try {
				const data = await Commands.findOne({ where: { ID }});
				if (data) {
					data.update(options);
					resolve({ data, signal: 'Update' });
				} else {
					Ctrl.createData( ID, options ).then((data) => { resolve({ data, signal: 'Set' }) }).catch(reject);
				}
			} catch (e) {
				reject(e);
			}
		});
	}
	
	///// GET
	Ctrl.getData = async function ( ID ) {
		
		try {
			const data = await Commands.findOne({ where: { ID }});
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
			const datas = (await Commands.findAll({ where, attributes })).map(e => e.get({ plain: true }));
			return datas;
		} catch (e) {
			console.error(e);
			return [];
		}
	}
	
	///// DELETE
	Ctrl.deleteData = async function ( ID ) {
		
		try {
			const data = await Commands.findOne({ where: { ID } });
			if (!data) { return false; }
			
			await data.destroy();
			return true;
			
		} catch (e) {
			console.error(e);
			return false;
		}
		
	}
	
	///// OTHER FUNCTIONS
	Ctrl.addCooldown = async function ( id, userID, timestamp ) {
		
		try {
			const data = await Ctrl.getData( id );
			if (data) {
				data.cooldowns[userID] = timestamp;
				return await Ctrl.setData( id, data ).then(() => {
					return true;
				}).catch(() => {
					return false;
				});
			}
		} catch (e) {
			console.error(e);
			return false;
		}
		
	}
	
	Ctrl.getCooldown = async function ( id, userID ) {
		
		try {
			const data = await Ctrl.getData( id );
			if (data) {
				return data.cooldowns[userID] || 0;
			}
			return 0;
		} catch (e) {
			console.error(e);
			return 0;
		}
		
	}

	return Ctrl;
}