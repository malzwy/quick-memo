const fs = require('fs-extra');
const path = require('path');
const { validateFullConfig } = require('./configSchema');

/**
 * Get the configuration file path based on current environment
 */
function getConfigPath() {
  return process.env.QUICK_MEMO_CONFIG || path.join(process.env.HOME || process.env.USERPROFILE, '.quick-memo', 'config.json');
}

// In-memory config cache (per-path to support QUICK_MEMO_CONFIG switching)
let configCache = null;
let configCachePath = null; // Track which path the cache belongs to
let configCacheStats = null; // Track cached file stats { size, mtimeMs }

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  const configDir = path.dirname(getConfigPath());
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Get default configuration
 */
function getDefaultConfig() {
  // Backward compatibility: allow env vars to override defaults
  const absoluteEnv = parseInt(process.env.QUICK_MEMO_SYNC_THRESHOLD, 10);
  const percentEnv = parseInt(process.env.QUICK_MEMO_SYNC_THRESHOLD_PERCENT, 10);

  let syncThresholdPercent = 5;
  let syncThresholdAbsolute = 0; // 0 means not set, so percent-based with floor 200

  if (!isNaN(absoluteEnv) && absoluteEnv > 0) {
    syncThresholdAbsolute = absoluteEnv;
  } else if (!isNaN(percentEnv) && percentEnv > 0) {
    syncThresholdPercent = percentEnv;
  }

  return {
    list: {
      sortBy: 'updated',
      sortAsc: true,
      detailed: false,
      json: false,
    },
    delete: {
      confirmDelete: true,
    },
    'trash-empty': {
      confirmDelete: true,
    },
    purge: {
      confirmDelete: true,
    },
    sync: {
      thresholdPercent: syncThresholdPercent,
      thresholdAbsolute: syncThresholdAbsolute,
    },
    // Proactive Security Masking (AGENTS.md pattern)
    masking: {
      autoMask: true,          // Mask sensitive content by default
      maskChar: '*',           // Character to use for masking
      showStart: 3,            // Number of characters to show at start
      showEnd: 3,              // Number of characters to show at end
      customPatterns: []       // User-defined regex patterns as strings
    }
  };
}

/**
 * Load configuration from disk, with caching
 * After the first load, subsequent calls return the cached config
 * without any filesystem access. Cache is updated via saveConfig().
 */
function loadConfig() {
  const configPath = getConfigPath();

  // Return cached config immediately if available AND from same path
  if (configCache !== null && configCachePath === configPath) {
    try {
      const stats = fs.statSync(configPath);
      if (configCacheStats && stats.size === configCacheStats.size && stats.mtimeMs === configCacheStats.mtimeMs) {
        return configCache;
      }
      // else file changed; fall through to reload
    } catch (e) {
      // file missing or inaccessible, fall through to reload
    }
  }

  // Load from disk (or use defaults if missing/invalid)
  let config;
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(data);
      // Capture file stats after read
      const stats = fs.statSync(configPath);
      configCacheStats = { size: stats.size, mtimeMs: stats.mtimeMs };
    } else {
      config = getDefaultConfig();
      configCacheStats = null;
    }
  } catch (e) {
    // On any read/parse error, use defaults
    config = getDefaultConfig();
    configCacheStats = null;
  }

  // Merge with defaults to ensure all keys exist
  config = mergeDeep(getDefaultConfig(), config);

  // Validate config
  const errors = validateFullConfig(config);
  if (errors.length > 0) {
    console.error('Invalid configuration detected:');
    for (const err of errors) {
      console.error(`  ${err.key}: ${err.error}`);
    }
    console.error('Resetting to defaults...');
    config = getDefaultConfig();
    // Note: after reset, we are not writing to disk, keep stats as null
    configCacheStats = null;
  }

  configCache = config;
  configCachePath = configPath;
  return config;
}

/**
 * Save configuration to disk atomically
 * Updates the in-memory cache to reflect the new configuration.
 */
function saveConfig(config) {
  ensureConfigDir();

  const configPath = getConfigPath();
  const tempPath = configPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tempPath, configPath);

  // Update cache to the new config and record file stats
  try {
    const stats = fs.statSync(configPath);
    configCacheStats = { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch (e) {
    configCacheStats = null;
  }
  configCache = config;
  configCachePath = configPath;
}

/**
 * Merge two objects deeply, with second object taking precedence
 */
function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * Check if value is a plain object (not array, not null)
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Get a specific configuration value by dot notation
 */
function getConfigKey(keyPath) {
  const config = loadConfig();
  const parts = keyPath.split('.');
  let current = config;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Set a specific configuration value by dot notation
 */
function setConfigKey(keyPath, value) {
  const config = loadConfig();
  const parts = keyPath.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid key path. Use dot notation: group.setting');
  }

  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
function resetConfig() {
  const defaults = getDefaultConfig();
  saveConfig(defaults);
  return defaults;
}

/**
 * Get effective command configuration by merging defaults, file config, and CLI options.
 * @param {Object} config - Full loaded config object
 * @param {string} commandName - Command name (e.g., 'list', 'delete')
 * @param {Object} options - Commander options object from CLI
 * @returns {Object} Effective configuration for the command
 */
function getCommandConfig(config, commandName, options) {
  const defaults = getDefaultConfig();
  const cmdDefaults = defaults[commandName] || {};
  const fileConfig = config[commandName] || {};
  const effective = { ...cmdDefaults, ...fileConfig };
  // Override with CLI options (all options from commander are considered provided)
  for (const [key, value] of Object.entries(options)) {
    effective[key] = value;
  }
  return effective;
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfigPath,
  getDefaultConfig,
  getConfigKey,
  setConfigKey,
  resetConfig,
  getCommandConfig,
};
