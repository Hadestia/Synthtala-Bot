const Moment = require('moment-timezone');
const Filesystem = require('fs-extra');
const Chalk = require('chalk');
const config = Filesystem.readJsonSync(__dirname + '/../json/configuration.json');

function log(name, content, color, colorContent) {
	const formatName = `[ ${name} ]⟩ `;
	const def_color = '#C3FF00';
	const msg = (typeof content == 'object' && content.stack) ? content.stack : content;
	console.log(`${Chalk.bold.hex(color || def_color).bold(formatName)} ${Chalk.hex(colorContent || color || def_color)(msg)}`);
}

module.exports.custom = log;

module.exports = (data, type, color) => {
	switch (type) {
		/// Defaults
		case 'system':
			log('System', data, color || '#ACFF7D', '#D0FFB5');
			break;
		case 'warn':
			log('Warning', data, color || '#FF9100', '#FFB451');
			break;
		case 'error':
			log('Error', data, color || '#FF0000', '#FF4F4F');
            break;
        case 'cache':
            log('Cache', data, color || '#FFEF00', '#FFF674');
            break;
        case 'assets':
        	log('Assets', data, color || '#ffb400', '#ffffff');
            break;
		case 'login':
			log('Logins', data, color || '#dbff00', '#f3ffaa');
			break;
		case 'bot':
			log('BOT', data, color || '#dbff00', '#f3ffaa');
			break;
		case 'listener':
			log('Listener', data, color || '#D800FF', '#ED89FF');
			break;
            
		/// Modules
		case 'module':
        	log('Module', data, color || '#ffb400', '#ffffff');
            break;
        case 'modInit':
        	log('Module-Init', data, color || '#ffb400', '#ffffff');
            break;
        case 'modLateInit':
        	log('Module-Init', data, color || '#bcff7a', '#ffffff');
            break;
        
        /// Other
        case 'hl':
            console.log(Chalk.hex(color || '#51ffd7')(data || '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            break;
        case 'database':
            log('DataBase', data, color || '#9050ff', '#ffffff');
            break;
            
        default:			        
            log(config.NAME, data, color || '#00ffff', '#ffffff');
			break;
	}
}


// Create & Update Logs

module.exports.makeLog = async function (fileName, data, logType) {
	
	const formattedTime = Moment().tz(config.timezone).format('MMMM/DD/YYYY hh:mm A');
	const formatLog = `${config.NAME} | ${formattedTime} \u27E9 ${(typeof data == 'object' && data.stack) ? data.stack : data}`;
	
	if (logType) {
		module.exports(data, logType);
	}
	
	if (config.logger) {
		try {
			(Filesystem.existsSync(fileName)) ? Filesystem.appendFile(fileName, `${formatLog}\n`) : Filesystem.writeFileSync(fileName, `${formatLog}\n`);
		} catch (e) {}
	}
}