const path = require('path');
const fs = require('fs');
const os = require('os');

// Setup
const testDir = path.join(os.tmpdir(), 'quick-memo-config-test');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
fs.mkdirSync(testDir);

const configPathEnv = path.join(testDir, 'config.json');
process.env.QUICK_MEMO_CONFIG = configPathEnv;

// Write valid config to configPathEnv
fs.writeFileSync(configPathEnv, JSON.stringify({ list: { sortBy: 'updated', sortAsc: true, detailed: true, json: false } }));

// Load config module
const { loadConfig, getConfigPath } = require('./src/lib/config');

console.log('=== Step 1: Load valid config from configPathEnv ===');
const validConfig = loadConfig();
console.log('Config path:', getConfigPath());
console.log('list.sortBy:', validConfig.list.sortBy);
console.log('Expected: updated');
console.log('PASS?', validConfig.list.sortBy === 'updated');

console.log('\n=== Step 2: Write invalid JSON to configPathEnv ===');
fs.writeFileSync(configPathEnv, 'invalid json{');
const invalidConfig = loadConfig();
console.log('list.sortBy after invalid:', invalidConfig.list.sortBy);
console.log('Should be default (created? or something else).');

console.log('\n=== Step 3: env var change to custom path ===');
const customConfigPath = path.join(testDir, 'custom-config.json');
fs.writeFileSync(customConfigPath, JSON.stringify({ list: { sortBy: 'content' } }));
process.env.QUICK_MEMO_CONFIG = customConfigPath;
console.log('Changed env var to:', customConfigPath);
console.log('getConfigPath() now:', getConfigPath());
const envConfig = loadConfig();
console.log('list.sortBy from custom config:', envConfig.list.sortBy);
console.log('Expected: content');
console.log('PASS?', envConfig.list.sortBy === 'content');

// Cleanup
fs.rmSync(testDir, { recursive: true }, ()=>{});
