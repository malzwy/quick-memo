#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { backupAndRotate, rotateBackups } = require('../../shared/backup');

const testDir = path.join(os.tmpdir(), 'quick-memo-backup-test');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log('🧪 Backup Rotation Test Suite\n');

// Helper to create backup file with given timestamp
function createBackup(basePath, timestamp) {
  const backupPath = `${basePath}.${timestamp}.bak`;
  fs.writeFileSync(backupPath, 'dummy');
}

// Test 1: Count-based rotation keeps most recent
console.log('Test 1: Count-based rotation keeps most recent');
const basePath = path.join(testDir, 'notes.json');

// Create 5 backups with milliseconds timestamps (now, now-1h, now-2h, now-3h, now-4h)
const now = Date.now();
const oneHour = 60 * 60 * 1000;
createBackup(basePath, now - 4 * oneHour); // oldest
createBackup(basePath, now - 3 * oneHour);
createBackup(basePath, now - 2 * oneHour);
createBackup(basePath, now - 1 * oneHour);
createBackup(basePath, now); // newest

// Rotate to keep max 3
rotateBackups(basePath, { maxBackups: 3, retentionDays: 30 });

const remaining = fs.readdirSync(testDir).filter(f => f.startsWith('notes.json.') && f.endsWith('.bak'));
if (remaining.length !== 3) {
  throw new Error(`Expected 3 backups after rotation, got ${remaining.length}: ${remaining}`);
}

// Ensure the kept backups are the ones with largest timestamps (3 newest)
const keptTimestamps = remaining.map(f => {
  const match = f.match(/^notes\.json\.(\d{13,})\.bak$/);
  return match ? parseInt(match[1], 10) : null;
}).filter(Boolean);
if (keptTimestamps.some(ts => ts < now - 2 * oneHour)) {
  throw new Error('Old backups should have been deleted; kept too old');
}
console.log('  ✓ Kept newest 3 backups');

// Test 2: Age-based rotation deletes old backups
console.log('\nTest 2: Age-based rotation deletes old backups');
// Clean directory for fresh test
fs.readdirSync(testDir).forEach(f => fs.unlinkSync(path.join(testDir, f)));

// Create a recent backup (timestamp now - 1 hour)
const recentTs = Date.now() - 60 * 60 * 1000;
createBackup(basePath, recentTs);

// Create an old backup (timestamp now - 2 days)
const oldTs = Date.now() - 2 * 24 * 60 * 60 * 1000;
createBackup(basePath, oldTs);

// Rotate with retentionDays = 1 (keep < 1 day old)
rotateBackups(basePath, { maxBackups: 10, retentionDays: 1 });

const remaining2 = fs.readdirSync(testDir).filter(f => f.startsWith('notes.json.') && f.endsWith('.bak'));
if (remaining2.length !== 1) {
  throw new Error(`Expected 1 backup after age rotation, got ${remaining2.length}: ${remaining2}`);
}
const keptFile = remaining2[0];
const keptMatch = keptFile.match(/^notes\.json\.(\d{13,})\.bak$/);
if (!keptMatch) throw new Error('Invalid kept file name');
const keptTs = parseInt(keptMatch[1], 10);
if (keptTs !== recentTs) {
  throw new Error('Only recent backup should remain');
}
console.log('  ✓ Old backups deleted by age');

// Test 3: Combined count and age
console.log('\nTest 3: Combined count and age limits');
fs.readdirSync(testDir).forEach(f => fs.unlinkSync(path.join(testDir, f)));
// Create 6 backups: 3 very old, 3 recent. retentionDays=1, maxBackups=3.
const now2 = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
for (let i = 0; i < 3; i++) {
  const oldTs = now2 - 10 * oneDay; // 10 days ago, subtract small offset to make distinct
  createBackup(basePath, oldTs - i * 1000);
}
for (let i = 0; i < 3; i++) {
  const recentTs = now2 - 12 * 60 * 60 * 1000; // 12 hours ago
  createBackup(basePath, recentTs + i * 1000);
}
rotateBackups(basePath, { maxBackups: 3, retentionDays: 1 });
const remaining3 = fs.readdirSync(testDir).filter(f => f.startsWith('notes.json.') && f.endsWith('.bak'));
if (remaining3.length !== 3) {
  throw new Error(`Expected 3 backups after combined rotation, got ${remaining3.length}: ${remaining3}`);
}
// All remaining should be recent ones (timestamp > cutoff)
const cutoff = now2 - oneDay;
for (const f of remaining3) {
  const match = f.match(/^notes\.json\.(\d{13,})\.bak$/);
  if (match) {
    const ts = parseInt(match[1], 10);
    if (ts < cutoff) {
      throw new Error(`Old backup ${f} should have been deleted`);
    }
  } else {
    throw new Error(`Invalid backup filename: ${f}`);
  }
}
console.log('  ✓ Combined rotation respects age then count');

console.log('\n✅ All backup rotation tests passed');
