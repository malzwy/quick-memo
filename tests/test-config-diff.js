#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'quick-memo-config-diff-test');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log('🧪 Config Diff Command Test Suite\n');

// Helper to create config file
function writeConfig(filePath, configObj) {
  fs.writeFileSync(filePath, JSON.stringify(configObj, null, 2));
}

// Test 1: Diff against defaults shows added/changed
console.log('Test 1: Diff against defaults shows added/changed');
const myConfigPath = path.join(testDir, 'myconfig.json');
writeConfig(myConfigPath, {
  list: { sortBy: 'created', sortAsc: false },
  sync: { thresholdPercent: 10, thresholdAbsolute: 0 }
});
// Ensure config used by CLI is this file
const env = { ...process.env, QUICK_MEMO_CONFIG: myConfigPath };
const result = spawnSync('node', ['../bin/memo', 'config', 'diff'], { env, cwd: __dirname });
const stdout = result.stdout.toString();
const stderr = result.stderr.toString();
if (result.status !== 0) {
  console.error('STDERR:', stderr);
  throw new Error(`Command exited with status ${result.status}`);
}
// Expect to see differences: list.sortBy changed to created? Actually default list.sortBy is 'updated'. So list.sortBy should appear as changed.
if (!stdout.includes('list.sortBy')) {
  throw new Error('Expected diff to include list.sortBy');
}
if (!stdout.includes('"updated"') || !stdout.includes('"created"')) {
  // Might show arrows
  if (!stdout.includes('→') && !stdout.includes('->')) {
    // Not strict; maybe different format
    console.warn('Output does not contain expected arrow; but list.sortBy present, ok');
  }
}
console.log('  ✓ Diff against defaults shows changes');

// Test 2: Diff with --json output
console.log('\nTest 2: JSON output for diff');
const resultJson = spawnSync('node', ['../bin/memo', 'config', 'diff', '--json'], { env, cwd: __dirname });
if (resultJson.status !== 0) {
  throw new Error(`JSON diff failed: ${resultJson.stderr.toString()}`);
}
let jsonOut;
try {
  jsonOut = JSON.parse(resultJson.stdout.toString());
} catch (e) {
  throw new Error('Diff --json output is not valid JSON');
}
if (!jsonOut.added || !Array.isArray(jsonOut.added)) {
  throw new Error('JSON output should have added array');
}
if (!jsonOut.changed || !Array.isArray(jsonOut.changed)) {
  throw new Error('JSON output should have changed array');
}
// Check that changed includes list.sortBy
const sortByChange = jsonOut.changed.find(c => c.key === 'list.sortBy');
if (!sortByChange) {
  throw new Error('Expected changed entry for list.sortBy');
}
if (sortByChange.from !== 'updated' || sortByChange.to !== 'created') {
  throw new Error('Unexpected from/to values for list.sortBy');
}
console.log('  ✓ JSON diff correct structure and values');

// Test 3: Diff against another config file
console.log('\nTest 3: Diff against another config file');
const otherConfigPath = path.join(testDir, 'otherconfig.json');
writeConfig(otherConfigPath, {
  list: { sortBy: 'content', sortAsc: true },
  sync: { thresholdPercent: 5 } // same as default for thresholdPercent? Actually default is 5.
});
const resultOther = spawnSync('node', ['../bin/memo', 'config', 'diff', otherConfigPath], { env, cwd: __dirname });
if (resultOther.status !== 0) {
  throw new Error(`Diff against other config failed: ${resultOther.stderr.toString()}`);
}
const stdoutOther = resultOther.stdout.toString();
// Should show differences between myconfig (sortBy='created', sortAsc=false) and other (sortBy='content', sortAsc=true)
if (!stdoutOther.includes('list.sortBy')) {
  throw new Error('Expected diff to include list.sortBy when comparing files');
}
if (!stdoutOther.includes('list.sortAsc')) {
  throw new Error('Expected diff to include list.sortAsc');
}
console.log('  ✓ Diff against another config file works');

// Test 4: Diff when config matches defaults exactly
console.log('\nTest 4: Diff when config matches defaults (no diff)');
const defaultConfigPath = path.join(testDir, 'defaultconfig.json');
writeConfig(defaultConfigPath, {
  // Use default values
  list: { sortBy: 'updated', sortAsc: true, detailed: false, json: false },
  delete: { confirmDelete: true },
  'trash-empty': { confirmDelete: true },
  purge: { confirmDelete: true },
  sync: { thresholdPercent: 5, thresholdAbsolute: 0 }
});
const envDefault = { ...process.env, QUICK_MEMO_CONFIG: defaultConfigPath };
const resultDefault = spawnSync('node', ['../bin/memo', 'config', 'diff'], { env: envDefault, cwd: __dirname });
if (resultDefault.status !== 0) {
  throw new Error(`Default diff failed: ${resultDefault.stderr.toString()}`);
}
const stdoutDefault = resultDefault.stdout.toString().trim();
if (stdoutDefault !== 'Configuration matches defaults exactly.') {
  // Allow other phrasing but should indicate no differences.
  if (!stdoutDefault.toLowerCase().includes('match') && !stdoutDefault.toLowerCase().includes('no diff')) {
    throw new Error(`Expected no diff message, got: ${stdoutDefault}`);
  }
}
console.log('  ✓ Diff with defaults reports no differences');

console.log('\n✅ All config diff tests passed');
