const { getConfigPath, loadConfig, saveConfig } = require('../lib/config');
const { validateConfigKey } = require('../lib/configSchema');
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
      let fullKey = null;
      if (parts.length === 2) {
        const [command, setting] = parts;
        if (!config[command]) config[command] = {};
        config[command][setting] = parsedValue;
        fullKey = key;
      } else if (parts.length === 1) {
        // Top-level key (unlikely but support)
        config[key] = parsedValue;
        fullKey = key;
      } else {
        return error('Only single-level dot notation supported (e.g., list.sortBy)');
      }

      // Validate the configuration value before saving
      if (fullKey) {
        const validationErr = validateConfigKey(fullKey, parsedValue);
        if (validationErr) {
          return error(`Invalid configuration: ${validationErr}`);
        }
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
      } else if (parts.length === 1) {
        // Top-level key
        if (Object.prototype.hasOwnProperty.call(config, key)) {
          delete config[key];
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
          success(`Unset ${key}`);
        } else {
          error(`Key ${key} not found in config`);
        }
      } else {
        error('Only single-level dot notation supported (e.g., list.sortBy)');
      }
    });

  // Validate current configuration
  configCommand
    .command('validate')
    .description('Validate the current configuration against schema')
    .action(() => {
      const config = loadConfig();
      const errors = [];
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value)) {
            const fullKey = `${key}.${subKey}`;
            const err = validateConfigKey(fullKey, subValue);
            if (err) {
              errors.push({ key: fullKey, error: err });
            }
          }
        } else {
          const err = validateConfigKey(key, value);
          if (err) {
            errors.push({ key, error: err });
          }
        }
      }

      if (errors.length === 0) {
        success('Configuration is valid');
        return;
      }

      console.log(chalk.red('\nConfiguration validation failed: '));
      for (const { key, error } of errors) {
        console.log(chalk.red(`  ✗ ${key}: ${error}`));
      }
      console.log();
      process.exit(1);
    });
};
