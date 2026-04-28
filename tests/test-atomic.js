#!/usr/bin/env node

/**
 * Atomic Operations Test Suite
 * Tests file locking, atomic writes, and new Store atomic methods.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const testDir = path.join(os.tmpdir(), 'quick-memo-atomic-test');
const testDataPath = path.join(testDir, 'notes.json');
const lockPath = testDataPath + '.lock';

// Ensure clean state
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

const FileLock = require('../src/lib/lock');
const Store = require('../src/lib/store');
const { generateId } = require('../src/lib/utils');

let passed = 0;
let failed = 0;

function resetStore() {
  // Delete notes and trash files to ensure clean state
  if (fs.existsSync(testDataPath)) fs.unlinkSync(testDataPath);
  const trashPath = testDataPath.replace(/\.json$/, '.trash.json');
  if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}

function test(name, fn) {
  try {
    // Reset store before each test to avoid state leakage
    resetStore();
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
}

console.log('\n🧪 Quick Memo Atomic Operations Test Suite\n');

// FileLock tests
test('FileLock: acquire and release create and remove lock file', () => {
  const lock = new FileLock(lockPath, { retries: 1, retryDelay: 10 });
  if (fs.existsSync(lockPath)) throw new Error('Lock file should not exist initially');
  lock.acquire();
  if (!fs.existsSync(lockPath)) throw new Error('Lock file should exist after acquire');
  lock.release();
  if (fs.existsSync(lockPath)) throw new Error('Lock file should be removed after release');
});

test('FileLock: exclusive lock - second lock attempt fails', () => {
  const lock1 = new FileLock(lockPath, { retries: 1, retryDelay: 10 });
  lock1.acquire();
  const lock2 = new FileLock(lockPath, { retries: 1, retryDelay: 10 });
  let errorThrown = false;
  try {
    lock2.acquire();
  } catch (e) {
    errorThrown = true;
  }
  lock1.release();
  if (!errorThrown) throw new Error('Second lock should fail when lock held');
});

test('FileLock: stale lock cleanup - lock file with dead PID removed', () => {
  // Create a lock file with a PID that definitely doesn't exist
  const fakePid = 999999;
  fs.writeFileSync(lockPath, String(fakePid));
  const lock = new FileLock(lockPath, { retries: 2, retryDelay: 10 });
  lock.acquire(); // should detect stale and acquire
  if (!fs.existsSync(lockPath)) throw new Error('Lock file should exist after acquire');
  const content = fs.readFileSync(lockPath, 'utf8');
  if (content != String(process.pid)) throw new Error('Lock file should contain our PID');
  lock.release();
});

// Store atomic methods tests
test('Store.deleteNote deletes note atomically', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'To delete', tags: [], createdAt: Date.now() };
  store.addNote(note);
  const all = store.getNotes();
  if (all.length !== 1) throw new Error('Should have 1 note');
  store.deleteNote(note.id);
  const after = store.getNotes();
  if (after.length !== 0) throw new Error('Note should be deleted');
});

test('Store.editNote updates note atomically', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'Original', tags: ['a'], createdAt: Date.now() };
  store.addNote(note);
  store.editNote(note.id, 'Edited', ['b']);
  const notes = store.getNotes();
  const edited = notes.find(n => n.id === note.id);
  if (!edited) throw new Error('Note should exist');
  if (edited.content !== 'Edited') throw new Error('Content should be updated');
  if (!edited.tags.includes('b')) throw new Error('Tags should be updated');
  if (!edited.updatedAt) throw new Error('updatedAt should be set');
});

test('Store.replaceAll replaces all notes atomically', () => {
  const store = new Store(testDataPath);
  // Add some initial notes
  store.addNotes([
    { id: '1', content: 'A', tags: [], createdAt: Date.now() },
    { id: '2', content: 'B', tags: [], createdAt: Date.now() }
  ]);
  const newNotes = [
    { id: '3', content: 'C', tags: [], createdAt: Date.now() },
    { id: '4', content: 'D', tags: [], createdAt: Date.now() }
  ];
  store.replaceAll(newNotes);
  const current = store.getNotes();
  if (current.length !== 2) throw new Error('Should have exactly 2 notes');
  if (!current.some(n => n.id === '3')) throw new Error('Should contain new note 3');
  if (!current.some(n => n.id === '4')) throw new Error('Should contain new note 4');
});

test('Store.untagNote removes tag atomically', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'Tagged', tags: ['x', 'y'], createdAt: Date.now() };
  store.addNote(note);
  const result = store.untagNote(note.id, 'x');
  if (result === false) throw new Error('Tag should be removed');
  const notes = store.getNotes();
  const updated = notes.find(n => n.id === note.id);
  if (!updated.tags.includes('y')) throw new Error('Tag y should remain');
  if (updated.tags.includes('x')) throw new Error('Tag x should be gone');
});

test('Store.trashNote moves note to trash atomically', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'Trash me', tags: [], createdAt: Date.now() };
  store.addNote(note);
  store.trashNote(note.id);
  const main = store.getNotes();
  const trash = store.getTrashNotes();
  if (main.length !== 0) throw new Error('Main notes should be empty');
  if (trash.length !== 1) throw new Error('Trash should have 1 note');
  if (trash[0].id !== note.id) throw new Error('Trash should contain correct note');
});

test('Store.restoreNote restores from trash atomically', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'Restore me', tags: [], createdAt: Date.now() };
  store.addNote(note);
  store.trashNote(note.id);
  store.restoreNote(note.id);
  const main = store.getNotes();
  const trash = store.getTrashNotes();
  if (main.length !== 1) throw new Error('Main notes should have 1');
  if (trash.length !== 0) throw new Error('Trash should be empty');
});

test('Store.permanentlyDelete removes note completely', () => {
  const store = new Store(testDataPath);
  const note = { id: generateId(), content: 'Delete me', tags: [], createdAt: Date.now() };
  store.addNote(note);
  store.trashNote(note.id);
  store.permanentlyDelete(note.id);
  const main = store.getNotes();
  const trash = store.getTrashNotes();
  if (main.length !== 0 || trash.length !== 0) throw new Error('Note should be gone from both');
});

// Concurrency test: two processes adding notes without losing data
test('Concurrent writes: multiple processes can add notes without corruption', () => {
  // Clean test directory
  if (fs.existsSync(testDataPath)) fs.unlinkSync(testDataPath);
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

  const child1 = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'memo'),
    'add', 'Note from child 1'
  ], { env: { ...process.env, QUICK_MEMO_PATH: testDataPath } });
  const child2 = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'memo'),
    'add', 'Note from child 2'
  ], { env: { ...process.env, QUICK_MEMO_PATH: testDataPath } });

  // Both should succeed
  if (child1.status !== 0) throw new Error(`Child 1 failed: ${child1.stderr.toString()}`);
  if (child2.status !== 0) throw new Error(`Child 2 failed: ${child2.stderr.toString()}`);

  // Verify both notes exist
  const store = new Store(testDataPath);
  const notes = store.getNotes();
  if (notes.length < 2) throw new Error(`Expected at least 2 notes, got ${notes.length}`);
  if (!notes.some(n => n.content.includes('child 1'))) throw new Error('Missing child 1 note');
  if (!notes.some(n => n.content.includes('child 2'))) throw new Error('Missing child 2 note');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Atomic Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All atomic tests passed');
}
console.log('='.repeat(50));
