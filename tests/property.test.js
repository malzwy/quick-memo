#!/usr/bin/env node

/**
 * Property-Based Tests for Quick Memo
 * Uses fast-check to generate arbitrary inputs and verify invariants.
 *
 * Run with: node tests/property.test.js
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test directory setup
const testDir = path.join(os.tmpdir(), 'quick-memo-property-test');
const testDataPath = path.join(testDir, 'notes.json');
const indexPath = path.join(testDir, 'index.json');

function resetTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

// Initial clean state
resetTestDir();

// Modules under test
const Store = require('../src/lib/store');
const IndexManager = require('../src/lib/indexManager');
const indexer = require('../src/lib/indexer');
const { generateId } = require('../src/lib/utils');

// Helper: create a store pointing to test directory
function createStore() {
  return new Store(testDataPath);
}

// Helper: arbitrary note generator
const noteArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { max: 5 }),
  createdAt: fc.integer({ min: 0, max: Date.now() }),
  updatedAt: fc.integer({ min: 0, max: Date.now() })
}).map(n => ({
  ...n,
  tags: [...new Set(n.tags)]
}));

// Generate notes with unique IDs within a batch
let generatedIds = new Set();
function generateUniqueId() {
  let id;
  do {
    id = generateId();
  } while (generatedIds.has(id));
  generatedIds.add(id);
  return id;
}
const notesArb = fc
  .array(noteArb, { min: 1, max: 100 })
  .map(notes => {
    generatedIds.clear();
    return notes.map(n => ({
      ...n,
      id: generateUniqueId()
    }));
  });

console.log('\n🧪 Quick Memo Property-Based Test Suite\n');

let passed = 0;
let failed = 0;

function runProperty(name, runner) {
  try {
    resetTestDir(); // Ensure isolation
    runner();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    if (err.details) console.log(`  Details: ${JSON.stringify(err.details)}`);
    failed++;
  }
}

// Property 1: Index bijection
runProperty('Index contains exactly the notes provided (bijection)', () => {
  fc.assert(fc.property(notesArb, (notes) => {
    const index = indexer.buildIndex(notes, testDataPath);
    if (index.notes.length !== notes.length) throw new Error('Length mismatch');
    const noteIds = new Set(notes.map(n => n.id));
    const indexIds = new Set(index.notes.map(n => n.id));
    for (const id of indexIds) if (!noteIds.has(id)) throw new Error(`Unknown ID: ${id}`);
    for (const id of noteIds) if (!indexIds.has(id)) throw new Error(`Missing ID: ${id}`);
  }));
});

// Property 2: Token map consistency
runProperty('TokenMap correctly maps tokens to note IDs', () => {
  fc.assert(fc.property(notesArb, (notes) => {
    const index = indexer.buildIndex(notes, testDataPath);

    // For each note that has tokens, verify each token's ID list includes the note
    for (const note of index.notes) {
      if (note.tokens.length === 0) continue;
      for (const token of note.tokens) {
        if (!index.tokenMap[token]) throw new Error(`Token ${token} missing`);
        if (!index.tokenMap[token].includes(note.id)) throw new Error(`Token ${token} lacks note ${note.id}`);
      }
    }

    // For each token in tokenMap, all referenced IDs must exist in notes
    for (const token of Object.keys(index.tokenMap)) {
      for (const id of index.tokenMap[token]) {
        const exists = index.notes.some(n => n.id === id);
        if (!exists) throw new Error(`Token ${token} references missing ID ${id}`);
      }
    }
  }));
});

// Property 3: Index rebuild after external changes
runProperty('Rebuild after external modification produces consistent index', () => {
  fc.assert(fc.property(notesArb, (notes) => {
    if (notes.length === 0) return;
    fs.writeFileSync(testDataPath, JSON.stringify(notes));
    const store = createStore();
    const indexMgr = new IndexManager(store);
    indexMgr.load();
    indexMgr.rebuild();

    // Create modified version: edit some, add some (don't delete all)
    const modified = JSON.parse(JSON.stringify(notes));
    if (modified.length > 0) {
      const editCount = Math.min(3, modified.length);
      for (let i = 0; i < editCount; i++) {
        modified[i].content = 'Changed: ' + modified[i].content;
        modified[i].updatedAt = Date.now();
      }
    }
    // Add a couple new notes
    for (let i = 0; i < 2; i++) {
      modified.push({
        id: generateUniqueId(),
        content: 'New note ' + Date.now(),
        tags: ['new'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    store.saveNotes(modified);
    indexMgr.load();
    indexMgr.rebuild();
    const index = indexMgr.getIndex();

    if (index.notes.length !== modified.length) throw new Error('Count mismatch after rebuild');
    const ids = new Set(index.notes.map(n => n.id));
    for (const n of modified) if (!ids.has(n.id)) throw new Error(`Missing note ${n.id}`);
  }));
});

// Property 4: replaceAll atomicity
runProperty('replaceAll completely replaces notes atomically', () => {
  fc.assert(fc.property(notesArb, notesArb, (initial, replacement) => {
    const store = createStore();
    store.replaceAll(initial);
    let after = store.getNotes();
    if (after.length !== initial.length) throw new Error('Initial replace failed');

    store.replaceAll(replacement);
    after = store.getNotes();
    if (after.length !== replacement.length) throw new Error('Replace length mismatch');
    const ids = new Set(after.map(n => n.id));
    for (const n of replacement) if (!ids.has(n.id)) throw new Error(`Missing note ${n.id}`);
  }));
});

// Property 5: IndexManager after* operations consistency
runProperty('IndexManager after* operations keep index consistent', () => {
  fc.assert(fc.property(notesArb, (initialNotes) => {
    if (initialNotes.length === 0) return;
    fs.writeFileSync(testDataPath, JSON.stringify(initialNotes));
    const store = createStore();
    const indexMgr = new IndexManager(store);
    indexMgr.load();
    indexMgr.rebuild();
    let index = indexMgr.getIndex();
    if (index.notes.length !== initialNotes.length) throw new Error('Initial index mismatch');

    // Perform sequence of adds, edits, deletes
    const notesCopy = [...initialNotes];
    const numOps = Math.min(notesCopy.length, 10);
    generatedIds.clear();

    for (let i = 0; i < numOps; i++) {
      const opType = Math.floor(Math.random() * 3);
      if (opType === 0) {
        // Add
        const newNote = {
          id: generateUniqueId(),
          content: 'New ' + Date.now(),
          tags: ['new'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        store.addNote(newNote);
        indexMgr.afterAdd(newNote);
        notesCopy.push(newNote);
      } else if (opType === 1 && notesCopy.length > 0) {
        // Edit
        const idx = Math.floor(Math.random() * notesCopy.length);
        const note = notesCopy[idx];
        const edited = { ...note, content: 'Edit ' + Date.now(), updatedAt: Date.now() };
        store.editNote(note.id, edited.content, edited.tags);
        indexMgr.afterEdit(edited);
        notesCopy[idx] = edited;
      } else if (notesCopy.length > 0) {
        // Delete
        const idx = Math.floor(Math.random() * notesCopy.length);
        const note = notesCopy[idx];
        store.deleteNote(note.id);
        indexMgr.afterDelete(note.id);
        notesCopy.splice(idx, 1);
      }
    }

    index = indexMgr.getIndex();
    if (index.notes.length !== notesCopy.length) throw new Error(`Post-ops length: ${index.notes.length} vs ${notesCopy.length}`);
    const finalIds = new Set(index.notes.map(n => n.id));
    for (const n of notesCopy) if (!finalIds.has(n.id)) throw new Error(`Missing ${n.id}`);
  }));
});

// Property 6: TokenMap accuracy
runProperty('TokenMap entries are accurate for all tokens', () => {
  fc.assert(fc.property(notesArb, (notes) => {
    const index = indexer.buildIndex(notes, testDataPath);
    // Check forward mapping
    for (const note of index.notes) {
      for (const token of note.tokens) {
        if (!index.tokenMap[token] || !index.tokenMap[token].includes(note.id)) {
          throw new Error(`Token ${token} not mapped to its note ${note.id}`);
        }
      }
    }
    // Check reverse mapping
    for (const token of Object.keys(index.tokenMap)) {
      for (const id of index.tokenMap[token]) {
        if (!index.notes.some(n => n.id === id)) {
          throw new Error(`Token ${token} references missing note ${id}`);
        }
      }
    }
  }));
});

// Summary
console.log(`\n📊 Property Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
