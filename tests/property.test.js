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

// Ensure IndexManager uses the test directory for index storage
process.env.QUICK_MEMO_INDEX_PATH = indexPath;

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
const { computeScore } = require('../src/lib/scoring');

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


let passed = 0;
let failed = 0;

async function runProperty(name, runner) {
  try {
    resetTestDir();
    await runner();
    passed++;
  } catch (err) {
    if (err.cause) console.log(`  Cause: ${err.cause.message || err.cause}`);
    if (err.details) console.log(`  Details: ${JSON.stringify(err.details)}`);
    failed++;
  }
}

// Collect all property test promises
const testPromises = [];

// Property 1: Index bijection
testPromises.push(runProperty('Index contains exactly the notes provided (bijection)', async () => {
  await fc.assert(fc.asyncProperty(notesArb, async (notes) => {
    const index = await indexer.buildIndex(notes, testDataPath);
    if (index.notes.length !== notes.length) throw new Error('Length mismatch');
    const noteIds = new Set(notes.map(n => n.id));
    const indexIds = new Set(index.notes.map(n => n.id));
    for (const id of indexIds) if (!noteIds.has(id)) throw new Error(`Unknown ID: ${id}`);
    for (const id of noteIds) if (!indexIds.has(id)) throw new Error(`Missing ID: ${id}`);
  }));
}));

// Property 2: Token map consistency
testPromises.push(runProperty('TokenMap correctly maps tokens to note IDs', async () => {
  await fc.assert(fc.asyncProperty(notesArb, async (notes) => {
    const index = await indexer.buildIndex(notes, testDataPath);
    // Forward mapping: every token in a note must map to that note
    for (const note of index.notes) {
      if (note.tokens.length === 0) continue;
      for (const token of note.tokens) {
        if (!index.tokenMap[token]) throw new Error(`Token ${token} missing`);
        if (!index.tokenMap[token].includes(note.id)) throw new Error(`Token ${token} lacks note ${note.id}`);
      }
    }
    // Reverse mapping: every token entry must reference existing notes
    for (const token of Object.keys(index.tokenMap)) {
      for (const id of index.tokenMap[token]) {
        if (!index.notes.some(n => n.id === id)) throw new Error(`Token ${token} references missing note ${id}`);
      }
    }
  }));
}));

// Property 3: Index rebuild after external changes
testPromises.push(runProperty('Rebuild after external modification produces consistent index', async () => {
  await fc.assert(fc.asyncProperty(notesArb, async (notes) => {
    if (notes.length === 0) return;
    fs.writeFileSync(testDataPath, JSON.stringify(notes));
    const store = createStore();
    const indexMgr = new IndexManager(store);
    indexMgr.load();
    await indexMgr.rebuild();

    // Create modified version: edit some, add some
    const modified = JSON.parse(JSON.stringify(notes));
    if (modified.length > 0) {
      const editCount = Math.min(3, modified.length);
      for (let i = 0; i < editCount; i++) {
        modified[i].content = 'Changed: ' + modified[i].content;
        modified[i].updatedAt = Date.now();
      }
    }
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
    await indexMgr.rebuild();
    const index = indexMgr.getIndex();

    if (index.notes.length !== modified.length) throw new Error('Count mismatch after rebuild');
    const ids = new Set(index.notes.map(n => n.id));
    for (const n of modified) if (!ids.has(n.id)) throw new Error(`Missing note ${n.id}`);
  }));
}));

// Property 4: replaceAll atomicity
testPromises.push(runProperty('replaceAll completely replaces notes atomically', () => {
  return fc.assert(fc.property(notesArb, notesArb, (initial, replacement) => {
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
}));

// Property 5: IndexManager after* operations consistency
// Fixed: Use store as source of truth; never rely on local copy.
testPromises.push(runProperty('IndexManager after* operations keep index consistent', async () => {
  await fc.assert(fc.asyncProperty(notesArb, async (initialNotes) => {
    if (initialNotes.length === 0) return;
    fs.writeFileSync(testDataPath, JSON.stringify(initialNotes));
    const store = createStore();
    const indexMgr = new IndexManager(store);
    indexMgr.load();
    await indexMgr.rebuild();
    let index = indexMgr.getIndex();
    const storeAfterRebuild = store.getNotes();
    if (index.notes.length !== initialNotes.length) throw new Error('Initial index mismatch');

    // Perform a sequence of adds, edits, deletes based on ACTUAL store state
    const numOps = Math.min(store.getNotes().length, 5);
    for (let i = 0; i < numOps; i++) {
      try {
        const opType = Math.floor(Math.random() * 3);
        const currentNotes = store.getNotes();
        if (opType === 0) {
          // Add
          const newNote = {
            id: generateUniqueId(),
            content: 'New ' + Date.now(),
            tags: ['new'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await store.addNote(newNote);
          await indexMgr.afterAdd(newNote);
        } else if (opType === 1 && currentNotes.length > 0) {
          // Edit: pick a random note from store
          const idx = Math.floor(Math.random() * currentNotes.length);
          const note = currentNotes[idx];
          const edited = { ...note, content: 'Edit ' + Date.now(), updatedAt: Date.now() };
          await store.editNote(note.id, edited.content, edited.tags);
          await indexMgr.afterEdit(edited);
        } else if (currentNotes.length > 0) {
          // Delete: pick a random note from store
          const idx = Math.floor(Math.random() * currentNotes.length);
          const note = currentNotes[idx];
          await store.deleteNote(note.id);
          await indexMgr.afterDelete(note.id);
        }
      } catch (e) {
        // Capture state for diagnosis
        const fileNotes = fs.readFileSync(testDataPath, 'utf8');
        const storeNotes = store.getNotes().map(n => ({ id: n.id, content: n.content }));
        throw new Error(`During ${e.name}: ${e.message}. Current store notes: ${JSON.stringify(storeNotes)}. File notes: ${fileNotes}`);
      }
    }

    // after* methods already update the index; get final index
    index = indexMgr.getIndex();
    const storeNotes = store.getNotes();
    if (index.notes.length !== storeNotes.length) {
      const indexIds = index.notes.map(n => n.id);
      const expectedIds = storeNotes.map(n => n.id);
      throw new Error(`Post-ops length mismatch: index has ${index.notes.length}, expected ${storeNotes.length}. Index IDs: [${indexIds.join(', ')}]. Store IDs: [${expectedIds.join(', ')}]`);
    }
    const finalIds = new Set(index.notes.map(n => n.id));
    for (const n of storeNotes) {
      if (!finalIds.has(n.id)) {
        const indexIds = index.notes.map(n => n.id);
        throw new Error(`Missing note ID ${n.id}. Index IDs: [${indexIds.join(', ')}]. Store IDs: [${storeNotes.map(n => n.id).join(', ')}]`);
      }
    }
  }));
}));

// Property 6: TokenMap entries accuracy
testPromises.push(runProperty('TokenMap entries are accurate for all tokens', async () => {
  await fc.assert(fc.asyncProperty(notesArb, async (notes) => {
    const index = await indexer.buildIndex(notes, testDataPath);
    // Forward mapping
    for (const note of index.notes) {
      for (const token of note.tokens) {
        if (!index.tokenMap[token] || !index.tokenMap[token].includes(note.id)) {
          throw new Error(`Token ${token} not mapped to its note ${note.id}`);
        }
      }
    }
    // Reverse mapping
    for (const token of Object.keys(index.tokenMap)) {
      for (const id of index.tokenMap[token]) {
        if (!index.notes.some(n => n.id === id)) throw new Error(`Token ${token} references missing note ${id}`);
      }
    }
  }));
}));

// Property 7: Fast scoring ranking guarantees
testPromises.push(runProperty('Fast scoring ranking guarantees', () => {
  const tokenArb = fc.string({ minLength: 1, maxLength: 10 });
  return fc.assert(fc.property(
    fc.array(tokenArb, { minSize: 1, maxSize: 5 }),
    fc.array(tokenArb),
    fc.array(tokenArb),
    (qArr, aArr, bArr) => {
      const queryTokens = new Set(qArr);
      const scoreA = computeScore(queryTokens, aArr);
      const scoreB = computeScore(queryTokens, bArr);
      const intersectionA = new Set([...queryTokens].filter(t => aArr.includes(t))).size;
      const coverageA = intersectionA / queryTokens.size;
      const intersectionB = new Set([...queryTokens].filter(t => bArr.includes(t))).size;
      const coverageB = intersectionB / queryTokens.size;
      if (coverageA > coverageB) {
        if (!(scoreA > scoreB)) throw new Error(`Coverage ${coverageA} should dominate ${coverageB}, but scores: ${scoreA} vs ${scoreB}`);
      }
      if (coverageA === coverageB && aArr.length !== bArr.length) {
        const shorter = aArr.length < bArr.length;
        const dominated = shorter ? scoreB >= scoreA : scoreA >= scoreB;
        if (dominated) throw new Error(`Equal coverage: shorter note should score higher than longer.`);
      }
    }
  ));
}));

// Run all tests sequentially to avoid interference from shared test directory
(async () => {
  for (const testPromise of testPromises) {
    await testPromise;
  }
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
