#!/usr/bin/env node

/**
 * Indexer Test Suite
 * Tests search index building, loading, rebuild detection, and integration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const stringSimilarity = require('string-similarity');

// Use the same test directory as test.js
const testDir = path.join(os.tmpdir(), 'quick-memo-test');
const testDataPath = path.join(testDir, 'notes.json');
const indexPath = path.join(testDir, 'index.json');

// Ensure testDir exists and is clean
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Load required modules
const indexer = require('../src/lib/indexer');
const Store = require('../src/lib/store');
const { generateId } = require('../src/lib/utils');

// Helper: simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
}

console.log('\n🧪 Quick Memo Indexer Test Suite\n');

// Test: Index building
test('buildIndex creates valid structure', () => {
  const notes = [
    { id: '1', content: 'Hello world', tags: ['a'], createdAt: Date.now() },
    { id: '2', content: 'Foo bar', tags: ['b'], createdAt: Date.now() }
  ];
  // Ensure the notes file exists so rev can be computed
  fs.writeFileSync(testDataPath, JSON.stringify(notes));
  const index = indexer.buildIndex(notes, testDataPath);
  if (!index) throw new Error('Index is null');
  if (index.version !== 1) throw new Error('Invalid version');
  if (index.noteCount !== 2) throw new Error('Wrong noteCount');
  if (!index.notes[0].contentLower) throw new Error('Missing contentLower');
  if (index.notes[0].contentLower !== 'hello world') throw new Error('contentLower incorrect');
  if (typeof index.rev !== 'string') throw new Error('Missing or invalid rev');
});

// Test: Save and load index
test('saveIndex and loadIndex', () => {
  const notes = [
    { id: 'a', content: 'Test note', tags: [], createdAt: Date.now() }
  ];
  const index = indexer.buildIndex(notes, testDataPath);
  indexer.saveIndex(index, indexPath);
  const loaded = indexer.loadIndex(indexPath);
  if (!loaded) throw new Error('Failed to load index');
  if (loaded.noteCount !== 1) throw new Error('Count mismatch');
  if (loaded.notes[0].id !== 'a') throw new Error('Note ID mismatch');
});

// Test: needsRebuild returns true when index missing
test('needsRebuild returns true when index missing', () => {
  if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
  const needs = indexer.needsRebuild(testDataPath, null);
  if (!needs) throw new Error('Should need rebuild when index is null');
});

// Test: needsRebuild returns true when notes file mtime changes
test('needsRebuild detects file modification', () => {
  // Create a dummy index
  const notes = [{ id: 'x', content: 'X', tags: [], createdAt: Date.now() }];
  const index = indexer.buildIndex(notes, testDataPath);
  indexer.saveIndex(index, indexPath);
  const loaded = indexer.loadIndex(indexPath);
  // Modify notes file (same content, different mtime)
  fs.writeFileSync(testDataPath, JSON.stringify(notes));
  const needs = indexer.needsRebuild(testDataPath, loaded);
  if (!needs) throw new Error('Should detect rebuild after modification');
});

// Test: needsRebuild returns false when index and notes in sync
test('needsRebuild returns false when up-to-date', () => {
  const notes = [{ id: 'y', content: 'Y', tags: [], createdAt: Date.now() }];
  fs.writeFileSync(testDataPath, JSON.stringify(notes));
  const index = indexer.buildIndex(notes, testDataPath);
  indexer.saveIndex(index, indexPath);
  const loaded = indexer.loadIndex(indexPath);
  const needs = indexer.needsRebuild(testDataPath, loaded);
  if (needs) throw new Error('Should not need rebuild when in sync');
});

// Test: getIndexedNotes returns notes array
test('getIndexedNotes returns notes', () => {
  const notes = [
    { id: 'n1', content: 'First', tags: ['x'], createdAt: 1, updatedAt: null, contentLower: 'first' },
    { id: 'n2', content: 'Second', tags: ['y'], createdAt: 2, updatedAt: null, contentLower: 'second' }
  ];
  const index = { notes };
  const result = indexer.getIndexedNotes(index);
  if (result.length !== 2) throw new Error('Wrong length');
  if (result[0].contentLower !== 'first') throw new Error('Lowercasing failed');
});

// Test: Integration with Store and search simulation
test('search using index matches expected notes', () => {
  // Prepare test data
  const store = new Store(testDataPath);
  // Clear and add notes
  store.saveNotes([
    { id: '101', content: 'Meeting notes', tags: ['work'], createdAt: Date.now() },
    { id: '102', content: 'Buy groceries', tags: ['personal'], createdAt: Date.now() },
    { id: '103', content: 'Meeting follow-up', tags: ['work'], createdAt: Date.now() }
  ]);
  // Build index
  const notes = store.getNotes();
  const index = indexer.buildIndex(notes, testDataPath);
  indexer.saveIndex(index, indexPath);
  // Simulate search logic (exact)
  const query = 'meeting';
  const queryLower = query.toLowerCase();
  const idx = indexer.loadIndex(indexPath);
  const indexedNotes = idx.notes;
  const results = indexedNotes.filter(n => n.contentLower.includes(queryLower));
  if (results.length !== 2) throw new Error(`Expected 2 results, got ${results.length}`);
  // All results should contain 'meeting' in original content (case-insensitive)
  for (const r of results) {
    if (!r.content.toLowerCase().includes(queryLower)) throw new Error('Result missing query');
  }
});

// Test: Fuzzy search uses precomputed contentLower
test('fuzzy search on index respects threshold', () => {
  const notes = [
    { id: 'f1', content: 'Meeting', tags: [], createdAt: Date.now() },
    { id: 'f2', content: 'Meting', tags: [], createdAt: Date.now() }, // typo
    { id: 'f3', content: 'Dinner', tags: [], createdAt: Date.now() }
  ];
  const store = new Store(testDataPath);
  store.saveNotes(notes);
  const index = indexer.buildIndex(store.getNotes(), testDataPath);
  indexer.saveIndex(index, indexPath);
  const idx = indexer.loadIndex(indexPath);
  const query = 'meeting';
  const threshold = 0.3;
  const scored = idx.notes.map(note => ({
    note,
    score: stringSimilarity.compareTwoStrings(query.toLowerCase(), note.contentLower)
  }));
  const results = scored.filter(s => s.score >= threshold).sort((a,b) => b.score - a.score);
  // Expect at least the exact match
  const hasExact = results.some(r => r.note.content === 'Meeting');
  if (!hasExact) throw new Error('Exact match should be in results');
  // The typo might also be included depending on threshold; we just check that scoring works
  if (results.length === 0) throw new Error('No results above threshold');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Indexer Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All indexer tests passed');
}
console.log('='.repeat(50));
