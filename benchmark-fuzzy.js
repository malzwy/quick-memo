#!/usr/bin/env node
/**
 * Quick Memo Fuzzy Search Performance Benchmark
 */

const Store = require('./src/lib/store');
const IndexManager = require('./src/lib/indexManager');
const { generateId } = require('./src/lib/utils');
const stringSimilarity = require('string-similarity');
const path = require('path');
const fs = require('fs');

const NUM_NOTES = 5000;
const TEST_DIR = '/tmp/quick-memo-fuzzy-bench';
const QUERY = 'test query';

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
      content: `Note ${i}: ${randomString(200)} with some test words like ${QUERY} and others`,
      tags: [`tag${i % 20}`],
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
  console.log('\\n=== Quick Memo Fuzzy Search Benchmark ===\\n');

  // Setup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const store = new Store(path.join(TEST_DIR, 'notes.json'));
  const indexMgr = new IndexManager(store);

  // Generate notes
  console.log(`Generating ${NUM_NOTES} notes...`);
  const notes = generateNotes(NUM_NOTES);
  store.replaceAll(notes);
  indexMgr.rebuild();
  console.log('Index built.');

  // Load index
  indexMgr.load();
  const index = indexMgr.getIndex();
  const indexedNotes = index.notes; // includes contentLower

  console.log('\\n--- Fuzzy Search Test ---');
  const queryLower = QUERY.toLowerCase();

  // Method 1: Use precomputed contentLower (as current code)
  const time1 = timeOperation('  Using indexed contentLower', () => {
    const scored = indexedNotes.map(note => ({
      note,
      score: stringSimilarity.compareTwoStrings(queryLower, note.contentLower)
    }));
    // Sort but don't output
    scored.sort((a, b) => b.score - a.score);
    const top10 = scored.slice(0, 10);
  });

  // Method 2: Simulate not using index (load full notes and lowercase on fly)
  const fullNotes = store.getNotes();
  const time2 = timeOperation('  Without index (lowercase each)', () => {
    const scored = fullNotes.map(note => ({
      note,
      score: stringSimilarity.compareTwoStrings(queryLower, note.content.toLowerCase())
    }));
    scored.sort((a, b) => b.score - a.score);
    const top10 = scored.slice(0, 10);
  });

  console.log('\\n--- Comparison ---');
  console.log(`Indexed: ${time1.toFixed(2)}ms`);
  console.log(`Non-indexed: ${time2.toFixed(2)}ms`);
  console.log(`Speedup: ${(time2/time1).toFixed(2)}x`);

  // Cleanup
  fs.rmSync(TEST_DIR, { recursive: true });
}

main().catch(console.error);
