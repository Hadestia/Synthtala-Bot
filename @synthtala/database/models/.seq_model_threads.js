module.exports = function ({ sequelize, Sequelize }) {
	
	const Threads = sequelize.define(
		'Threads',
		{
			NUM: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			
			THREADID: {
				type: Sequelize.BIGINT,
				allowNull: false,
				unique: true
			},
			
			threadInfo: {
				type: Sequelize.JSON,
				allowNull: false
			},
			
			banned: {
				type: Sequelize.BOOLEAN,
				defaultValue: false
			},
			
			inventory: {
				type: Sequelize.JSON,
				defaultValue: {}
			},
			
			economy: {
				type: Sequelize.JSON,
				defaultValue: {}
			},
			
			settings: {
				type: Sequelize.JSON,
				defaultValue: {}
			},
		
			data: {
				type: Sequelize.JSON,
				defaultValue: {}
			},

			afk: {
				type: Sequelize.JSON,
				defaultValue: {}
			}
		}
	);
	
	return Threads;
}