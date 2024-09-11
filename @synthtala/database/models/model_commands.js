module.exports = function ({ sequelize, Sequelize }) {
	
	const Commands = sequelize.define(
		'Commands',
		{
			NUM: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			
			ID: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true
			},
			
			cooldowns: {
				type: Sequelize.JSON,
				defaultValue: {}
			},
			
			data: {
				type: Sequelize.JSON,
				defaultValue: {}
			}
		}
	);
	
	return Commands;
}