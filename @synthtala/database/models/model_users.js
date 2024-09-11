module.exports = function ({ sequelize, Sequelize }) {
	
	const Users = sequelize.define(
		'Users',
		{
			NUM: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
		
			USERID: {
				type: Sequelize.BIGINT,
				allowNull: false,
				unique: true
			},
		
     	   name: {
          	  type: Sequelize.STRING,
				allowNull: false
     	   },
        
     	   experience: {
				type: Sequelize.BIGINT,
				defaultValue: 1
			},
		
			banned: {
				type: Sequelize.BOOLEAN,
				defaultValue: false
			},
        
			data: {
				type: Sequelize.JSON,
				defaultValue: {}
			}
		}
	);
	
	return Users;
}