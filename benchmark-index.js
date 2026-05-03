#!/usr/bin/env node
/**
 * Quick Memo Index Performance Benchmark
 * Compares full rebuild vs incremental sync after partial changes.
 */

const Store = require('./src/lib/store');
const IndexManager = require('./src/lib/indexManager');
const { generateId } = require('./src/lib/utils');

const NUM_NOTES = 5000;
const CHANGE_PERCENT = 0.05; // 5% changes
const TEST_DIR = '/tmp/quick-memo-benchmark';

// Ensure test dir exists
const fs = require('fs');
const path = require('path');
if (fs.existsSync(TEST_DIR)) {
  fs.rmSync(TEST_DIR, { recursive: true });
}
fs.mkdirSync(TEST_DIR, { recursive: true });

function randomString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: generateId(),
      content: `Note ${i}: ${randomString(100)}`,
      tags: [`tag${i % 10}`],
      createdAt: Date.now() - Math.floor(Math.random() * 1000000000)
    });
  }
  return notes;
}

function timeOperation(label, fn) {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1000000;
  console.log(`${label}: ${ms.toFixed(2)}ms`);
  return ms;
}

async function main() {
  console.log('\\n=== Quick Memo Index Benchmark ===\\n');
  const store = new Store(path.join(TEST_DIR, 'notes.json'));

  // Phase 1: Generate initial notes and save
  console.log(`Generating ${NUM_NOTES} initial notes...`);
  const initialNotes = generateNotes(NUM_NOTES);
  store.replaceAll(initialNotes);

  // Phase 2: Build index (cold)
  const indexMgr = new IndexManager(store);
  console.log('\\nBuilding initial index...');
  timeOperation('  Full rebuild (cold)', () => {
    indexMgr.rebuild();
  });
  const initialIndex = indexMgr.getIndex();
  console.log(`  Index entries: ${initialIndex.notes.length}`);

  // Phase 3: Simulate partial changes (5% of notes)
  const numChanges = Math.floor(NUM_NOTES * CHANGE_PERCENT);
  console.log(`\\nSimulating ${numChanges} changes (adds/edits/deletes)...`);
  const changes = [];
  const shuffled = [...Array(NUM_NOTES).keys()].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numChanges; i++) {
    const idx = shuffled[i];
    const note = initialNotes[idx];
    if (i % 3 === 0) {
      // Edit: change content and tags
      changes.push({ type: 'edit', note: { ...note, content: note.content + ' MODIFIED', tags: [...note.tags, 'modified'] } });
    } else if (i % 3 === 1) {
      // Delete
      changes.push({ type: 'delete', id: note.id });
    } else {
      // Add new
      changes.push({ type: 'add', note: { id: generateId(), content: `New note ${i}`, tags: ['new'], createdAt: Date.now() } });
    }
  }

  // Apply changes to store (bypass index manager to simulate external edits)
  const currentNotes = store.getNotes();
  // We'll directly mutate in-memory then save once to simulate batch operation
  for (const change of changes) {
    if (change.type === 'delete') {
      const idx = currentNotes.findIndex(n => n.id === change.id);
      if (idx !== -1) currentNotes.splice(idx, 1);
    } else if (change.type === 'edit') {
      const idx = currentNotes.findIndex(n => n.id === change.note.id);
      if (idx !== -1) currentNotes[idx] = change.note;
    } else if (change.type === 'add') {
      currentNotes.push(change.note);
    }
  }
  store.saveNotes(currentNotes);

  // Now index is stale (fresh=false). Load it again to detect staleness.
  indexMgr.load(); // will set fresh=false
  console.log(`  Index fresh after changes: ${indexMgr.isFresh()}`);

  // Phase 4: Measure full rebuild (traditional)
  // First, we need to backup current index to restore for fair comparison? We'll do separate runs using rebuild.
  const indexMgrRebuild = new IndexManager(store);
  indexMgrRebuild.load(); // fresh = false initially
  const rebuildTime = timeOperation('  Full rebuild (stale)', () => {
    indexMgrRebuild.rebuild();
  });

  // Phase 5: Measure incremental sync (new)
  // Reset store state to before sync, and re-load index to be stale
  store.saveNotes(currentNotes); // ensure same state
  const indexMgrSync = new IndexManager(store);
  indexMgrSync.load(); // stale
  const syncTime = timeOperation('  Incremental sync (stale)', () => {
    indexMgrSync.syncStaleIndex();
  });

  // Verify sync produced correct index
  const syncedIndex = indexMgrSync.getIndex();
  const expectedCount = currentNotes.length;
  if (syncedIndex.notes.length !== expectedCount) {
    console.error(`ERROR: Index count mismatch. Expected ${expectedCount}, got ${syncedIndex.notes.length}`);
    process.exit(1);
  }

  // Phase 6: Verify search correctness
  // Simple check: pick a random note and ensure it's searchable by content
  const sampleNote = currentNotes[Math.floor(Math.random() * currentNotes.length)];
  const query = sampleNote.content.substring(0, 10).toLowerCase();
  const indexer = require('./src/lib/indexer');
  const notesFromIndex = indexer.getIndexedNotes(syncedIndex);
  const found = notesFromIndex.find(n => n.id === sampleNote.id);
  if (!found || found.content !== sampleNote.content) {
    console.error('ERROR: Search index content mismatch after sync');
    process.exit(1);
  }
  console.log('  Index content validated.');

  // Summary
  console.log('\\n=== Comparison ===');
  console.log(`Full rebuild: ${rebuildTime.toFixed(2)}ms`);
  console.log(`Incremental sync: ${syncTime.toFixed(2)}ms`);
  const speedup = rebuildTime / syncTime;
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  console.log(`\\nNote: For ${NUM_NOTES} notes with ${numChanges} changes (${(CHANGE_PERCENT*100).toFixed(1)}%), incremental sync avoids full re-index.`);

  // Cleanup
  fs.rmSync(TEST_DIR, { recursive: true });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
