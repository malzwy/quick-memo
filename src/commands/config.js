const { getConfigPath, loadConfig, saveConfig } = require('../lib/config');
const { validateConfigKey } = require('../lib/configSchema');
const { success, error, info } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

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

      // Special handling for sync settings (ensure they're in the right format)
      if (fullKey === 'sync.thresholdPercent' || fullKey === 'sync.thresholdAbsolute') {
        const syncConfig = config.sync || {};
        if (typeof syncConfig.thresholdPercent !== 'number' && fullKey === 'sync.thresholdPercent') {
          syncConfig.thresholdPercent = parsedValue;
        }
        if (typeof syncConfig.thresholdAbsolute !== 'number' && fullKey === 'sync.thresholdAbsolute') {
          syncConfig.thresholdAbsolute = parsedValue;
        }
        // Ensure sync object exists and has both values
        if (!config.sync) {
          config.sync = {};
        }
        config.sync = syncConfig;
        fullKey = 'sync';
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

  // Get a configuration value
  configCommand
    .command('get <key>')
    .description('Retrieve a configuration value (supports dot notation)')
    .option('--default <value>', 'Default value if key is not found')
    .action((key, options) => {
      const config = loadConfig();
      const parts = key.split('.');
      let value;
      if (parts.length === 2) {
        const [group, setting] = parts;
        value = config[group]?.[setting];
        // Special handling for sync settings (return as object)
        if (group === 'sync' && setting === undefined) {
          value = config.sync || {};
        }
      } else if (parts.length === 1) {
        value = config[key];
      } else {
        return error('Only single-level dot notation supported (e.g., list.sortBy)');
      }

      if (value === undefined) {
        if (options.default !== undefined) {
          console.log(options.default);
        } else {
          error(`Key ${key} not found in config`);
          process.exit(1);
        }
      } else {
        // Output raw value for scripting; use JSON.stringify for objects
        if (typeof value === 'object' && value !== null) {
          console.log(JSON.stringify(value));
        } else {
          console.log(String(value));
        }
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

  // Diff configuration against defaults or another config file
  configCommand
    .command('diff [otherConfigPath]')
    .description('Show differences between current configuration and defaults (or another configuration file)')
    .option('--json', 'Output in JSON format')
    .action((otherConfigPath, options) => {
      const { loadConfig, getDefaultConfig } = require('../lib/config');
      const currentConfig = loadConfig();

      let otherConfig;
      if (otherConfigPath) {
        if (!fs.existsSync(otherConfigPath)) {
          return error(`Config file not found: ${otherConfigPath}`);
        }
        try {
          const data = fs.readFileSync(otherConfigPath, 'utf8');
          otherConfig = JSON.parse(data);
        } catch (e) {
          return error(`Failed to parse config file: ${e.message}`);
        }
      } else {
        otherConfig = getDefaultConfig();
      }

      // Flatten configs into dot-keyed maps
      const flatten = (obj, prefix = '') => {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flatten(value, fullKey));
          } else {
            result[fullKey] = value;
          }
        }
        return result;
      };

      const flatCurrent = flatten(currentConfig);
      const flatOther = flatten(otherConfig);

      // Compute differences
      const added = [];   // in current but not in other
      const removed = []; // in other but not in current
      const changed = []; // in both but different
      // Use deep equality to avoid false positives for objects/arrays
      const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

      // Check all keys in current
      for (const key of Object.keys(flatCurrent)) {
        if (!(key in flatOther)) {
          added.push({ key, value: flatCurrent[key] });
        } else {
          const currentVal = flatCurrent[key];
          const otherVal = flatOther[key];
          if (!deepEqual(currentVal, otherVal)) {
            changed.push({ key, from: otherVal, to: currentVal });
          }
        }
      }

      // Check for keys only in other
      for (const key of Object.keys(flatOther)) {
        if (!(key in flatCurrent)) {
          removed.push({ key, value: flatOther[key] });
        }
      }

      // Output
      if (options.json) {
        console.log(JSON.stringify({ added, removed, changed }, null, 2));
      } else {
        let output = '';
        if (added.length) {
          output += chalk.green('Added (custom):\n');
          for (const { key, value } of added) {
            output += `  + ${key} = ${JSON.stringify(value)}\n`;
          }
        }
        if (removed.length) {
          output += chalk.red('Removed (no longer used):\n');
          for (const { key, value } of removed) {
            output += `  - ${key} = ${JSON.stringify(value)}\n`;
          }
        }
        if (changed.length) {
          output += chalk.yellow('Changed:\n');
          for (const { key, from, to } of changed) {
            output += `  ! ${key}: ${JSON.stringify(from)} → ${JSON.stringify(to)}\n`;
          }
        }
        if (!added.length && !removed.length && !changed.length) {
          output = 'Configuration matches defaults exactly.';
        }
        console.log(output.trim());
      }
    });
};
