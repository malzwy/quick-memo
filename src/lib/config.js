const fs = require('fs');
const path = require('path');
const os = require('os');

function getConfigPath() {
  const envPath = process.env.QUICK_MEMO_CONFIG;
  if (envPath) return envPath;
  return path.join(os.homedir(), '.quick-memo', 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    // Log warning but don't crash - return empty config
    console.error(`Warning: Could not parse config file at ${configPath}: ${e.message}`);
    return {};
  }
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function getCommandConfig(config, command, options = {}) {
  const cmdConfig = config[command] || {};

  // For list command, we support these config keys
  if (command === 'list') {
    // Determine effective values: CLI options take precedence over config
    // For sort field: options.sort may be null if not provided (we'll set default to null in option def)
    const sortBy = options.sort !== undefined && options.sort !== null
      ? options.sort
      : (cmdConfig.sortBy !== undefined ? cmdConfig.sortBy : 'created');

    // Validate sortBy value
    const validSortFields = ['created', 'updated', 'content'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created';

    // For boolean flags: options.asc is false if not present; we want to use config if user didn't set flag explicitly
    // Since boolean flag `--asc` sets true, absence leaves false. We treat false as "not explicitly set" unless config overrides.
    // However, if user wants asc false, they can't set --no-asc; so default is false. Our config can change default to true.
    const sortAsc = options.asc === true ? true : (cmdConfig.sortAsc !== undefined ? cmdConfig.sortAsc : false);

    const detailed = options.detailed === true ? true : (cmdConfig.detailed !== undefined ? cmdConfig.detailed : false);
    const json = options.json === true ? true : (cmdConfig.json !== undefined ? cmdConfig.json : false);

    return {
      sortBy: finalSortBy,
      sortAsc,
      detailed,
      json
    };
  }

  // For delete command: config.confirmDelete (default true)
  if (command === 'delete') {
    if (options.force === true) {
      return { confirm: false }; // --force overrides config
    }
    const confirm = cmdConfig.confirmDelete !== undefined ? cmdConfig.confirmDelete : true;
    return { confirm };
  }

  // For trash-empty command
  if (command === 'trash-empty') {
    if (options.force === true) {
      return { confirm: false };
    }
    const confirm = cmdConfig.confirmDelete !== undefined ? cmdConfig.confirmDelete : true;
    return { confirm };
  }

  // For purge command
  if (command === 'purge') {
    if (options.force === true) {
      return { confirm: false };
    }
    const confirm = cmdConfig.confirmDelete !== undefined ? cmdConfig.confirmDelete : true;
    return { confirm };
  }

  // Default: return empty config (no overrides)
  return {};
}

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
  getCommandConfig
};
