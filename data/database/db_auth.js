const Sequelize = require('sequelize');

module.exports = function (db_name) {
	
	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: db_name,
		pool: {
			max: 250,
			min: 0,
			acquire: 30000,
			idle: 10000
		},
		retry: {
			match: [
				/SQLITE_BUSY/,
			],
			name: 'query',
			max: 250
		},
		logging: false,
		transactionType: 'IMMEDIATE',
		define: {
			underscored: false,
			freezeTableName: true,
			charset: 'utf8',
			dialectOptions: {
				collate: 'utf8_general_ci'
			},
			timestamps: true
		},
		sync: {
			force: false
		}
	});
	
	return {
		sequelize,
		Sequelize
	};
}