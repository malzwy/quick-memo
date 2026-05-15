#!/usr/bin/env node
// Benchmark: Index incremental sync performance after stale index
const Store = require('../src/lib/store');
const IndexManager = require('../src/lib/indexManager');
const { v4: uuidv4 } = require('uuid'); // not available? We'll generate simple IDs

// Simple ID generator if uuid not available
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {}
}

// Configuration
const NOTE_COUNT = 1000;
const CHANGES = {
  added: 10,
  edited: 5,
  deleted: 5
};
const TOTAL_CHANGES = CHANGES.added + CHANGES.edited + CHANGES.deleted;

// Use a temporary directory for benchmark
const tmpDir = '/tmp/quick-memo-incremental-bench';
const { execSync } = require('child_process');
execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`);
const notesPath = `${tmpDir}/notes.json`;
const indexPath = `${tmpDir}/index.json`;
process.env.QUICK_MEMO_PATH = notesPath;

console.log(`\n📊 Incremental Sync Benchmark`);
console.log(`─────────────────────────────`);
console.log(`Dataset: ${NOTE_COUNT} notes`);
console.log(` simulating ${TOTAL_CHANGES} changes after stale index`);

// Generate base dataset
function generateNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: generateId(),
      content: `Note ${i}: This is sample content with some words for indexing.`,
      tags: ['test', i % 2 === 0 ? 'even' : 'odd'],
      createdAt: Date.now() - Math.random() * 1000000000,
      updatedAt: Date.now() - Math.random() * 1000000000
    });
  }
  return notes;
}

// Step 1: Create initial store and build index
console.log('\n1. Initializing store with notes...');
const initialNotes = generateNotes(NOTE_COUNT);
const store = new Store();
store.ensureDir();
store.saveNotes(initialNotes);

// Build index initially
const indexMgr = new IndexManager(store);
indexMgr.load();
console.log('   Building fresh index...');
const buildStart = Date.now();
indexMgr.rebuild();
const buildTime = Date.now() - buildStart;
console.log(`   ✅ Initial index built in ${buildTime}ms`);

// Step 2: Simulate external changes that make index stale
console.log('\n2. Simulating external modifications to make index stale...');
// We'll modify notes file directly to simulate powerloss: change file size/mtime but index remains unchanged
// Actually easiest: add notes via store.addNotes? That would update index if fresh. We want index stale.
// So we'll directly modify the notes file to invalidate the index.
const notesAfterChange = JSON.parse(JSON.stringify(initialNotes));
// Add new notes
for (let i = 0; i < CHANGES.added; i++) {
  notesAfterChange.push({
    id: generateId(),
    content: `New note ${i}: Added after stale`,
    tags: ['new'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}
// Edit existing notes (update updatedAt)
for (let i = 0; i < CHANGES.edited; i++) {
  const idx = i % (NOTE_COUNT - CHANGES.deleted); // avoid ones we will delete
  notesAfterChange[idx].content = `Edited note ${idx}: content modified`;
  notesAfterChange[idx].updatedAt = Date.now();
}
// Delete some notes (remove from array)
const deleteIndices = [];
for (let i = 0; i < CHANGES.deleted; i++) {
  const delIdx = NOTE_COUNT - 1 - i;
  deleteIndices.push(notesAfterChange[delIdx].id);
  notesAfterChange.splice(delIdx, 1);
}
// Write changes directly to file (bypassing index manager)
store.saveNotes(notesAfterChange);
// Note: index file still reflects old state; index.rev != current file rev => stale

// Step 3: Force load index (which will be stale)
console.log('\n3. Loading stale index...');
indexMgr.load();
console.log(`   Index fresh? ${indexMgr.isFresh()}`);

// Step 4: Trigger reconciliation via afterAdd (which will call maybeReconcile)
console.log('\n4. Performing operation that triggers index update (add note)...');
const triggerNote = {
  id: generateId(),
  content: 'Trigger note via afterAdd',
  tags: ['trigger'],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const beforeTime = Date.now();
indexMgr.afterAdd(triggerNote);
const syncTime = Date.now() - beforeTime;
console.log(`   ✅ Index update completed in ${syncTime}ms`);
console.log(`   Index fresh? ${indexMgr.isFresh()}`);

// Verify: index.noteCount should match notesAfterChange.length + 1 (trigger)
const expectedCount = notesAfterChange.length + 1;
console.log(`   Index note count: ${indexMgr.getIndex().noteCount} (expected ~${expectedCount})`);

// Step 5: Compare to full rebuild time (re-run from stale)
// Reset index to stale state: load index file from disk? That is same stale index. We can just call rebuild and measure.
console.log('\n5. Measuring full rebuild time for comparison...');
// To simulate stale, we need to reload index from disk, but we have it in memory already as not fresh after afterAdd? Actually afterAdd made it fresh. So we need to artificially mark as stale:
indexMgr.fresh = false;
const rebuildStart = Date.now();
indexMgr.rebuild();
const rebuildTime = Date.now() - rebuildStart;
console.log(`   ✅ Full rebuild completed in ${rebuildTime}ms`);

console.log('\n📈 Results');
console.log('─────────────');
console.log(`Incremental sync: ${syncTime}ms`);
console.log(`Full rebuild:     ${rebuildTime}ms`);
console.log(`Speedup:          ${(rebuildTime / syncTime).toFixed(1)}x faster`);
console.log(`\nNote: Incremental sync time includes processing ${TOTAL_CHANGES} actual changes plus one trigger add.`);
console.log(`Threshold used: ${Math.max(200, Math.floor(NOTE_COUNT * 0.05))} changes (5% of ${NOTE_COUNT} or 200)`);

// Cleanup
// execSync(`rm -rf ${tmpDir}`);
