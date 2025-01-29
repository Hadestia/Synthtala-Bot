const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const Path = require('path');
const Ctrl = {};


// Defaults
const defaultData = {};
const db = new Low(new JSONFile('../datas/users.json'), defaultData);

module.exports = async function ({ GLOBAL }) {
	
	Ctrl.init = async function () {
		await db.read();
		db.data ||= defaultData;
	}
	
	Ctrl.resetData = async function () {
		db.data = defaultData;
		await db.write();
	}
	
	Ctrl.getAll = async function () {
		await Ctrl.init();
		return db.data;
	}
	
	Ctrl.getData = async function (id) {
		await Ctrl.init();
		if (db.data[id]) {
			return db.data[id];
		} else {
			return false;
		}
	}
	
	Ctrl.setData = function (id, obj) {
		db.update((data) => {
			data[id] = obj
		});
	}
	
	Ctrl.deleteData = function (id) {
		return new Promise(async (res, rej) => {
			if (db.data[id]) {
				delete db.data[id];
				db.write();
				res(`${id} was deleted`);
			} else {
				rej(`${id} doesn't exist`);
			}
		});
	}
	
	return Ctrl;
}