const configModule = require('../src/lib/config.js');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

// Setup: create a temporary directory for config file
const testDir = path.join(os.tmpdir(), 'quick-memo-config-mtime');
const configPath = path.join(testDir, 'config.json');

// Ensure clean start
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Override getConfigPath via env
process.env.QUICK_MEMO_CONFIG = configPath;

function writeConfig(content) {
  fs.writeFileSync(configPath, JSON.stringify(content), 'utf8');
}

console.log('Testing config mtime caching...');

// 1. Write initial config
const initialConfig = {
  list: { sortBy: 'updated', sortAsc: true, detailed: false, json: false },
  delete: { confirmDelete: true },
  'trash-empty': { confirmDelete: true },
  purge: { confirmDelete: true },
  sync: { thresholdPercent: 5, thresholdAbsolute: 0 }
};
writeConfig(initialConfig);

// 2. Load first time - should read from disk and cache
const config1 = configModule.loadConfig();
if (!config1) throw new Error('loadConfig returned null');
console.log('First load OK');

// 3. Load second time without modification - should return same object (cached)
const config2 = configModule.loadConfig();
if (config1 !== config2) {
  throw new Error('Second load without changes should return cached object');
}
console.log('Cache hit OK');

// 4. Modify config file externally (simulate another process)
// The act of writing will update mtime, so reload will be triggered.
writeConfig({ ...initialConfig, list: { sortBy: 'created' } });

// 5. Load again - should detect change and return new object (different reference)
const config3 = configModule.loadConfig();
if (config3 === config1 || config3 === config2) {
  throw new Error('Should have reloaded after file change');
}
if (config3.list.sortBy !== 'created') {
  throw new Error('Config should reflect changes from file');
}
console.log('Cache invalidation OK');

console.log('All config mtime caching tests passed! ✅');
