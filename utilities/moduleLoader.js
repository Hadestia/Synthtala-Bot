const Logger = require('./logger.js');
const Filesystem = require('fs-extra');
const ChildProcess = require('child_process');
const Path = require('path');

const projectInfo = Filesystem.readJsonSync(Path.resolve(__dirname, '../', 'package.json'));

//// Handle deep module searching
async function handleInnerModuleDirectory(path, handleObject) {
			
	const directory = Filesystem.readdirSync(path).filter(name => 
		!name.startsWith('.') &&
		!name.startsWith('_') &&
		!name.includes('cache')
	);
			
	for (const value of directory) {
		
		const isFile = (value.lastIndexOf('.') == -1) ? false : true;
		
		if (!value.startsWith('.') && !value.startsWith('_')) {
			const newPath = Path.join(path, value);
			if (value.endsWith('.json')) {
					
				await handleObject(path, newPath, value);
			// assuming it was a directory
			} else {
				if (!isFile) {
					await handleInnerModuleDirectory(newPath, handleObject);
				}
			}
		}
	}
}

module.exports.load = async function ( path, CLIENT ) {
	
	const eventsPath = Path.join(CLIENT.CACHE_PATH, 'keep', '!registeredEvents.json');
	const commandsPath = Path.join(CLIENT.CACHE_PATH, 'keep', '!registeredCommands.json');
	
	//const toJson_events = Filesystem.readJsonSync(eventsPath);
	//const toJson_commands = Filesystem.readJsonSync(commandsPath);
	
	const workingModules = [];
	const defectiveModules = [];
	
	const allModulesID = new Map();
	const commandAliases = new Map();
	const cmdModulesName = new Map();
	
	const parseModule = require('./parseModule.js');
	const installedPackages = projectInfo.dependencies;
	const installedBuiltInPackages = require('module').builtinModules;

	Logger.makeLog(CLIENT.LOG_PATH, 'Fetching Module files...', 'module');
	
	const rootPath = Path.join(CLIENT.ROOT_PATH, 'modules');
	const modulesFolder = Filesystem.readdirSync(rootPath);
	
	//// Collect and Parse Modules
	for (const type of modulesFolder) {
	
		// const categories = readdirSync(join(rootPath, type));
		await handleInnerModuleDirectory(Path.join(rootPath, type), async function (folderPath, objectPath, fileName) {
			const objects = require(objectPath);
			try {
				Logger.makeLog(CLIENT.LOG_PATH, `${fileName}: Collecting drafts..`, 'module');
				// @Type Objects []
				for (const obj of objects) {
					
					const { moduleData, moduleScriptPath, error } = await parseModule(obj, fileName, objectPath, folderPath);
					
					if (error) {
						
						defectiveModules[defectiveModules.length] = { fileName, error };
						const errMsg = `${fileName}: Draft ${(obj.id || '!!')} unable to initialize with error:\n${error}.`;
						Logger.makeLog(CLIENT.LOG_PATH, errMsg);
						throw new Error(errMsg);
						
					} else {
						/// Already Used ID?
						if (allModulesID.has(moduleData.id)) {
							const errMsg = `${fileName}: Module ID "${moduleData.id}" was already in used, Kindly change it to something unique!`
							Logger.makeLog(CLIENT.LOG_PATH, errMsg);
							throw new Error(errMsg);
						} else {
							allModulesID.set(moduleData.id, true);
						}
					
						/// Already Used Aliases?
						if (moduleData.type == 'command') {
							/// Replace Spacing With '-' From Module's Name
							moduleData.name = moduleData.name.replace(/\s+/g, '-');
							/// Already Used Name?
							if (cmdModulesName.has(moduleData.name)) {
								const errMsg = `${moduleData.id}: Module Name "${moduleData.name}" was already in used, Kindly change it to something unique!`
								Logger.makeLog(CLIENT.LOG_PATH, errMsg);
								throw new Error(errMsg);
							} else {
								cmdModulesName.set(moduleData.name, true);
							}
							
							if (moduleData.aliases) {
								for (const alias of moduleData.aliases) {
									if (commandAliases.has(alias)) {
										const errMsg = `Aliases "${alias}" from ${moduleData.id} was already in used, Kindly change it to something unique!`
										Logger.makeLog(CLIENT.LOG_PATH, errMsg);
										throw new Error(errMsg);
									} else {
										commandAliases.set(alias, moduleData.id);
									}
								}
							}
						}
						
						let havingError = [];
						/// CHECK DEPENDENCIES
						if (moduleData.dependencies && typeof(moduleData.dependencies) == 'object') {
							for (const required_dependency in moduleData.dependencies) {
								
								const version = moduleData.dependencies[required_dependency];							
								// check if dependency was existing
								try {
									if (installedPackages[required_dependency]) {
										const module_version = moduleData.dependencies[required_dependency];
										const installed_version = (installedPackages[required_dependency]).replace(/\^/g, '');
										if (module_version !== '' && installed_version !== module_version) {
											throw 'OUTDATED_DEPENDENCY';
										 }
										const package = require(required_dependency);
									}
									
									if (installedBuiltInPackages[required_dependency]) {
										const package = require(required_dependency);
									}
								} catch (err) {
									/// Try to Install
									try {
										const ver = (version == '*' || version == '') ? '' : `@${version}`;
										Logger.makeLog(CLIENT.LOG_PATH, `${moduleData.id} Installing Dependency Package: ${required_dependency}${ver}...`, '--');
										await ChildProcess.execSync(
											`npm ---package-lock false --save install ${required_dependency}${ver}`,
											{
												stdio: 'inherit',
												env : process.env,
												shell: true,
												cwd: CLIENT.ROOT_PATH
											}
										);
										/// test 3 times
										for (let i = 1; i <= 3; i++) {
											const package = require(required_dependency);
										}
									} catch (error) {
										havingError.push(true);
										if (defectiveModules.findIndex(i => i === module.id) < 0) {
											defectiveModules[defectiveModules.length] = module.id;
										}
										Logger.makeLog(CLIENT.LOG_PATH, `Unable to install "${required_dependency}" dependency for module: ${moduleData.id}!!`, 'warn');
										Logger.makeLog(CLIENT.LOG_PATH, error);
									}
								}
							}
						}
						
						/// Append to list of avail module
						if (!havingError.includes(true)) {
							workingModules[workingModules.length] = { moduleData, moduleScriptPath };
							Logger.makeLog(CLIENT.LOG_PATH, `Initialized Draft[${moduleData.id}].`, 'module');
						}
					}
				}
				
			} catch (err) {
				Logger.makeLog(CLIENT.LOG_PATH, err, 'error');
				throw err;
			}
		});
	}
	
	const totalMod = workingModules.length + defectiveModules.length;
	
	// console.log('working modules:', workingModules);
	const returnModules = {
		commands: {},
		cmd_names: {},
		cmd_aliases: {},
		events: {}
	}
	
	workingModules.forEach((item) => {
		const id = item.moduleData.id
		const type = item.moduleData.type;
		if (type == 'command') {
			//toJson_commands.COMMANDS[id] = item.moduleData;
			returnModules.commands[id] = { moduleData: item.moduleData, moduleScriptPath: item.moduleScriptPath };
			returnModules.cmd_names[item.moduleData.name] = id;
		} else {
			//toJson_events[id] = item.moduleData;
			returnModules.events[id] = { moduleData: item.moduleData, moduleScriptPath: item.moduleScriptPath };
		}
	});
	
	// For Aliases [alias] = 'cmdID'
	commandAliases.forEach(( v, k ) => {
		//toJson_commands.ALIASES[k] = v;
		returnModules.cmd_aliases[k] = v;
	});
	
	/*Filesystem.writeFileSync(eventsPath, JSON.stringify(toJson_events, null, 4), 'utf8');
	Filesystem.writeFileSync(commandsPath, JSON.stringify(toJson_commands, null, 4), 'utf8');
	*/
	
	if (workingModules.length > 0) {
		Logger.makeLog(CLIENT.LOG_PATH, `Successfully initialized ${workingModules.length}/${totalMod} modules.`, 'module');
	} else {
		Logger.makeLog(CLIENT.LOG_PATH, `No modules found in the directory, You may want to add some.`, 'warn');
	}
	
	if (defectiveModules.length > 0) {
		Logger.makeLog(CLIENT.LOG_PATH, `${defectiveModules.length} defective module[s] found, Kindly check ${CLIENT.LOG_PATH} for information.`, 'warn');
	}
	
	return returnModules;
}