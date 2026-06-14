#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Setup isolated test directory
const testDir = path.join(os.tmpdir(), 'quick-memo-config-validation-test');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log('🧪 Config Validation Test Suite\n');

// Helper to isolate config cache
function setConfigEnv(path) {
  process.env.QUICK_MEMO_CONFIG = path;
}

// Helper to create config file
function writeConfig(filePath, configObj) {
  fs.writeFileSync(filePath, JSON.stringify(configObj, null, 2));
}

// Test 1: Invalid sync.thresholdPercent (out of range)
console.log('Test 1: Invalid sync.thresholdPercent falls back to default');
const configPath1 = path.join(testDir, 'config1.json');
writeConfig(configPath1, { sync: { thresholdPercent: 150 } });
setConfigEnv(configPath1);
const { loadConfig, getDefaultConfig } = require('../src/lib/config');
const config1 = loadConfig();
const defaults = getDefaultConfig();
if (config1.sync.thresholdPercent !== defaults.sync.thresholdPercent) {
  throw new Error('Expected thresholdPercent to be default after invalid value');
}
console.log('  ✓ Invalid thresholdPercent reset to default');

// Test 2: Invalid list.sortBy (non-allowed value)
console.log('\nTest 2: Invalid list.sortBy falls back to default');
const configPath2 = path.join(testDir, 'config2.json');
writeConfig(configPath2, { list: { sortBy: 'invalid' } });
setConfigEnv(configPath2);
const config2 = loadConfig();
if (config2.list.sortBy !== defaults.list.sortBy) {
  throw new Error('Expected list.sortBy to be default after invalid value');
}
console.log('  ✓ Invalid list.sortBy reset to default');

// Test 3: Invalid sync.thresholdAbsolute (negative)
console.log('\nTest 3: Invalid sync.thresholdAbsolute falls back to default');
const configPath3 = path.join(testDir, 'config3.json');
writeConfig(configPath3, { sync: { thresholdAbsolute: -5 } });
setConfigEnv(configPath3);
const config3 = loadConfig();
if (config3.sync.thresholdAbsolute !== defaults.sync.thresholdAbsolute) {
  throw new Error('Expected thresholdAbsolute to be default after invalid value');
}
console.log('  ✓ Invalid thresholdAbsolute reset to default');

// Test 4: Invalid type for list.sortAsc (string instead of boolean)
console.log('\nTest 4: Invalid type for boolean setting');
const configPath4 = path.join(testDir, 'config4.json');
writeConfig(configPath4, { list: { sortAsc: 'yes' } });
setConfigEnv(configPath4);
const config4 = loadConfig();
if (config4.list.sortAsc !== defaults.list.sortAsc) {
  throw new Error('Expected list.sortAsc to be default after invalid type');
}
console.log('  ✓ Invalid boolean type reset to default');

// Test 5: Any invalid setting causes full config reset to defaults
console.log('\nTest 5: Any invalid setting causes full reset to defaults');
const configPath5 = path.join(testDir, 'config5.json');
writeConfig(configPath5, {
  list: { sortBy: 'updated', sortAsc: false },
  sync: { thresholdPercent: 150 }
});
setConfigEnv(configPath5);
const config5 = loadConfig();
// Even though list.sortBy is default, other valid setting list.sortAsc should be lost, resetting to default.
if (config5.list.sortBy !== defaults.list.sortBy) {
  throw new Error('list.sortBy should be default after invalid config');
}
if (config5.list.sortAsc !== defaults.list.sortAsc) {
  throw new Error('list.sortAsc should be default after invalid config');
}
if (config5.sync.thresholdPercent !== defaults.sync.thresholdPercent) {
  throw new Error('Invalid thresholdPercent should be reset to default');
}
console.log('  ✓ Invalid config causes full reset to defaults');

// Test 6: Unknown top-level group is allowed and preserved (forward compatibility)
console.log('\nTest 6: Unknown groups are allowed and preserved');
const configPath6 = path.join(testDir, 'config6.json');
writeConfig(configPath6, {
  unknownGroup: { setting: 'value' },
  list: { sortBy: 'created' }
});
setConfigEnv(configPath6);
const config6 = loadConfig();
if (config6.unknownGroup?.setting !== 'value') {
  throw new Error('Unknown group should be preserved');
}
if (config6.list.sortBy !== 'created') {
  throw new Error('List config should be retained');
}
console.log('  ✓ Unknown groups preserved');

// Test 7: Invalid delete.confirmDelete type
console.log('\nTest 7: Invalid type for delete.confirmDelete');
const configPath7 = path.join(testDir, 'config7.json');
writeConfig(configPath7, { delete: { confirmDelete: 'no' } });
setConfigEnv(configPath7);
const config7 = loadConfig();
if (config7.delete.confirmDelete !== defaults.delete.confirmDelete) {
  throw new Error('Invalid delete.confirmDelete should reset to default');
}
console.log('  ✓ Invalid delete.confirmDelete reset to default');

// Test 8: Valid all settings should load without reset
console.log('\nTest 8: Valid full config loads correctly');
const configPath8 = path.join(testDir, 'config8.json');
writeConfig(configPath8, {
  list: { sortBy: 'content', sortAsc: true, detailed: false, json: true },
  delete: { confirmDelete: false },
  'trash-empty': { confirmDelete: false },
  purge: { confirmDelete: false },
  sync: { thresholdPercent: 10, thresholdAbsolute: 0 }
});
setConfigEnv(configPath8);
const config8 = loadConfig();
if (config8.list.sortBy !== 'content') throw new Error('sortBy mismatch');
if (config8.list.sortAsc !== true) throw new Error('sortAsc mismatch');
if (config8.delete.confirmDelete !== false) throw new Error('delete.confirmDelete mismatch');
if (config8.sync.thresholdPercent !== 10) throw new Error('thresholdPercent mismatch');
console.log('  ✓ Valid config loads correctly');

console.log('\n✅ All config validation tests passed');
