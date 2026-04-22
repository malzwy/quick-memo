const { getConfigPath, loadConfig, saveConfig } = require('../lib/config');
const { success, error, info } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');

module.exports = function registerConfigCommand(program) {
  const configCommand = program.command('config')
    .description('Manage configuration settings');

  configCommand
    .command('show')
    .description('Display current configuration')
    .action(() => {
      const configPath = getConfigPath();
      const config = loadConfig();

      if (Object.keys(config).length === 0) {
        info('No configuration file found or config is empty.');
        info(`Config location: ${configPath}`);
        return;
      }

      console.log(JSON.stringify(config, null, 2));
      info(`Config location: ${configPath}`);
    });

  configCommand
    .command('set <key> <value>')
    .description('Set a configuration value (supports nested keys with dot notation)')
    .action((key, value) => {
      const configPath = getConfigPath();
      const config = loadConfig();

      // Parse value: try JSON first for booleans/numbers, fallback to string
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string, handle "true"/"false" as strings? Actually JSON.parse would work for true/false/numbers
        parsedValue = value;
      }

      // Support simple dot notation (only one level for now: command.key)
      const parts = key.split('.');
      if (parts.length === 2) {
        const [command, setting] = parts;
        if (!config[command]) config[command] = {};
        config[command][setting] = parsedValue;
      } else if (parts.length === 1) {
        // Top-level key (unlikely but support)
        config[key] = parsedValue;
      } else {
        return error('Only single-level dot notation supported (e.g., list.sortBy)');
      }

      // Ensure directory exists
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
    });

  configCommand
    .command('unset <key>')
    .description('Remove a configuration key')
    .action((key) => {
      const configPath = getConfigPath();
      const config = loadConfig();

      const parts = key.split('.');
      if (parts.length === 2) {
        const [command, setting] = parts;
        if (config[command] && config[command].hasOwnProperty(setting)) {
          delete config[command][setting];
          // Clean up empty command objects
          if (Object.keys(config[command]).length === 0) {
            delete config[command];
          }
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
          success(`Unset ${key}`);
        } else {
          error(`Key ${key} not found in config`);
        }
      } else {
        error('Only single-level dot notation supported (e.g., list.sortBy)');
      }
    });
};
