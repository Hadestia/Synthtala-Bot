const Filesystem = require('fs-extra');

module.exports = function ({ GLOBAL, BOT_INFO, Bans, Users, Threads, Utils, Logger }) {
	
	const defaultDatabaseReference = Filesystem.readJsonSync(`${GLOBAL.CLIENT.ROOT_PATH}/json/ref-defaultDatabase.json`);

	const Handler = {}
	Handler.allUserIDs = {};
	Handler.allGroupIDs = {};
	
	Handler.createUpdateUserData = async function ( User, Info ) {
	
		return new Promise (async (resolve, reject) => {
			try {
				const reference = defaultDatabaseReference.user_db;
				const isUpdate = (User) ? true : false;
				
				if (!isUpdate) {
					User = reference;
				}
	
				User.USERID = Info.id;
				User.name = Info.name;
	
				/// Check New features from the database reference
				// # Data
				const ref_data = reference.data;
				for (const key in ref_data) {
					if (!key in User.data) {
						User.data[key] = ref_data[key];
					}
				}
	
				// Handle bans
				const bans = await Bans.getData( Info.id );
				if (bans) {
					// Update Group data In Bans Tables
					bans.NAME = Info.name;
					Bans.setData(Info.threadID, bans).then(() => {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Updated Ban Data For User ${Info.id}`, 'bot')
					}).catch((e) => {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Unable To Update Ban Data For User ${Info.id}!`, 'warn')
						console.error(e);
					});
					User.banned = true
				}
				
				// console.dir(User);
				await Users.setData( User.USERID, User ).then((obj) => {
					
					Handler.allUserIDs[User.USERID] = { last_update: Date.now() };
					
					if (isUpdate) {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » ${obj.signal} Update Table For UserID ${Info.id}(${Info.name})`, 'bot');
					} else {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » ${obj.signal} Table For UserID ${Info.id}(${Info.name})`, 'bot');
					}
					// console.dir(result);
					resolve(true);
				}).catch((err) => {
					Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Unable To Set Or Update Table For UserID ${Info.id}(${Info.name})\n${err}`, 'warn');
					console.error(err);
					reject(err);
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	Handler.createUpdateGroupData = async function ( Group, Info ) {
		
		return new Promise (async (resolve, reject) => {
			try {
				const reference = defaultDatabaseReference.group_db;
				const isUpdate = (Group) ? true : false;
				
				if (!isUpdate) {
					Group = reference;
					Group.settings['bot-prefix'] = GLOBAL.CLIENT.CONFIG.defaultPrefix;
				}
			
				Group.THREADID = Info.threadID;
				Group.threadInfo.threadName = Info.threadName;
				Group.threadInfo.adminIDs = Info.adminIDs.map((item) => item.id);
				Group.threadInfo.nicknames = Info.nicknames;
				Group.threadInfo.threadImage = (Info.imageSrc) ? Info.imageSrc : 'dummyUrl';
				
				// Visual checks
				//console.dir(Group.threadInfo.nicknames);
			
				/// Check New features from the database reference
				// # Settings
				const ref_settings = reference.settings
				for (const key in ref_settings) {
					if (!key in Group.settings) {
						Group.settings[key] = ref_settings[key];
					}
				}
	
				// # Data
				const ref_data = reference.data;
				for (const key in ref_data) {
					if (!key in Group.data) {
						Group.data[key] = ref_data[key];
					}
				}
		
				// Handle bans
				const bans = await Bans.getData( Info.threadID );
				if (bans) {
					// Update Group data In Bans Tables
					bans.NAME = Info.threadName;
						Bans.setData(Info.threadID, bans).then(() => {
					Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Updated Ban Data For Group ${Info.threadID}`, 'bot')
					}).catch((e) => {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Unable To Update Ban Data For Group ${Info.threadID}!`, 'warn')
						console.error(e);
					});
					Group.banned = true
				}
				
				const ref_inventory = defaultDatabaseReference.groupUserInventory_db;
				const ref_economy = defaultDatabaseReference.groupUserEconomy_db;
				
				// Handle users info from this group
				for (const entity of Info.userInfo) {
					
					// # Inventory
					if (!Group.inventory[entity.id]) {
						Group.inventory[entity.id] = new Object(ref_inventory);
					} else { // check for new keys
						for (const key in ref_inventory) {
							if (!key in Group.inventory[entity.id]) {
								Group.inventory[entity.id][key] = ref_inventory[key]
							}
						}
					}
		
					// # Economy
					if (!Group.economy[entity.id]) {
						Group.economy[entity.id] = new Object (ref_economy);
					} else { // check for new keys
						for (const key in ref_economy) {
							if (!key in Group.economy[entity.id]) {
								Group.economy[entity.id][key] = ref_economy[key];
							}
						}
					}
			
					if (!Handler.allUserIDs[entity.id]) {
						const old_data = await Users.getData(entity.id);
						await Handler.createUpdateUserData( old_data, entity ).then(() => {}).catch(() => {});
					}
				}
			
				// Test
				//console.dir(Group);
				await Threads.setData( Group.THREADID, Group ).then((obj) => {
					
					Handler.allGroupIDs[Group.THREADID] = { last_update: Date.now() };

					if (isUpdate) {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » ${obj.signal} Update Table For GroupID ${Info.threadID}(${Info.threadName})`, 'bot');
					} else {
						Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » ${obj.signal} Table For GroupID ${Info.threadID}(${Info.threadName})`, 'bot');
					}
					
					resolve(true);
				}).catch((err) => {
					Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID} » Unable To Set Or Update Table For GroupID ${Info.threadID}(${Info.threadName})\n${err}`, 'warn');
					console.error(err);
					reject(err);
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	Handler.check = async function ({ event, API, GLOBAL }) {
		
		return new Promise(async( resolve, reject ) => {
		
			if (!GLOBAL.CLIENT.CONFIG.database) {
				return resolve(true);
			}
			
			let { senderID, threadID, isGroup } = event;
			
			//console.log('All ID\'s:\n', Handler.allUserIDs, Handler.allGroupIDs);
			
			if (isGroup && !Handler.allGroupIDs[threadID]) {
				
				const info = await Threads.getInfo(threadID);
				const old_data = await Threads.getData(threadID);
				
				if (info && info.threadID !== undefined) {
					await Handler.createUpdateGroupData( old_data, info ).then(resolve).catch(reject);
				} else {
					reject (`No Information Found For Group ${threadID}`)
				}
			} else {
				resolve(true);
			}
			
			
			if (!Handler.allUserIDs[senderID]) {
				
				const info = await Users.getInfo(senderID);
				const old_data = await Users.getData(senderID);
				
				if (info && info.id !== undefined) {
					await Handler.createUpdateUserData( old_data, info ).then(resolve).catch(reject);
				} else {
					reject (`No Information Found For User ${senderID}`)
				}
				
			} else {
				resolve(true);
			}
			
		});
	}
	
	Handler.init = async function ({ API }) {
		
		let allUsers = await Users.getAll([ 'USERID', 'name', 'experience', 'banned', 'data' ]);
		let allThreads = await Threads.getAll([ 'THREADID', 'threadInfo', 'banned', 'inventory', 'economy', 'settings', 'data', 'afk' ]);
		
		for (const User of allUsers) {
			const ID = String(User.USERID);
			const Info = await Users.getInfo( ID );
			if (Info && Info.name && Info.id) {
				await Handler.createUpdateUserData( User, Info ).then(() => {
				}).catch(console.error);
			} else {
				await Users.deleteData(ID);
				API.deleteThread(ID, (e)=>{});
			}
		}
		
		const mainGroups = GLOBAL.CLIENT.CONFIG.mainGroups || [];
		for (const Group of allThreads) {
			const ID = String(Group.THREADID);
			const Info = await Threads.getInfo(ID);
			if (Info && Info.threadID) {
				// If bot was unable to reply on this shit
				if (Info.cannotReplyReason) {
					API.deleteThread(ID, (e)=>{});
					await Threads.deleteData(ID);
					Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Group ${ID}(${Info.threadName}) was deleted from database due bot was unable to interact with a reason: ${Info.cannotReplyReason}`, 'database');
				} else {
					// Check if group was inactive for 5 days
					const timeDiff = Math.abs(Date.now() - Info.timestamp);
					// Auto left on that group // EXCEPT: MAIN GROUPS
					if (timeDiff >= 432000000 && !mainGroups.includes(ID)) {
						const howLong = await Utils.getRemainingTime(Math.floor(timeDiff/1000));
						API.sendMessage(
							Utils.textFormat('events', 'inactiveGroupNotice', howLong.text),
							ID,
							async (e) => {
								API.removeUserFromGroup(BOT_INFO.ID, ID, (e)=>{});
								API.deleteThread(ID, (e)=>{});
								await Threads.deleteData(ID);
								Logger.makeLog(GLOBAL.CLIENT.LOG_PATH, `Bot-${BOT_INFO.ID}(${BOT_INFO.NAME}) » Group ${ID}(${Info.threadName}) was deleted from database due inactivity of ${howLong}`, 'database');
							}
						);
					} else {
						await Handler.createUpdateGroupData( Group, Info ).then(() => {
						}).catch(console.error);
					}
				}
			}
		}
		return;
	}
	
	return Handler;
};