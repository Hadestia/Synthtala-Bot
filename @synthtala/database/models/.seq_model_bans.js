module.exports = function ({ sequelize, Sequelize }) {
	
	const Bans = sequelize.define(
		'Bans',
		{
			NUM: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			
			ID: {
				type: Sequelize.BIGINT,
				allowNull: false,
				unique: true
			},
			
			NAME: {
				type: Sequelize.STRING,
				allowNull: false
			},
			
			data: {
				type: Sequelize.JSON,
				allowNull: false,
				defaultValue: {}
			}
		}
	);
	
	return Bans;
}