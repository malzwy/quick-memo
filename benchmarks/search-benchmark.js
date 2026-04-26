#!/usr/bin/env node

/**
 * Search Performance Benchmark
 * Compares search performance with and without index for various dataset sizes
 *
 * Usage: node benchmarks/search-benchmark.js [notesCount]
 * Default notesCount: 10000
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const stringSimilarity = require('string-similarity');

// Import from the tool
const Store = require('../src/lib/store');
const indexer = require('../src/lib/indexer');

// Configuration
const notesCount = process.argv[2] ? parseInt(process.argv[2]) : 10000;
const warmupRuns = 5;
const measuredRuns = 20;
const queries = [
  { text: 'meeting', fuzzy: false },
  { text: 'meet', fuzzy: true, threshold: 0.3 },
  { text: 'project', fuzzy: false },
  { text: 'projet', fuzzy: true, threshold: 0.3 } // typo
];

// Benchmark utility
function benchmark(fn, runs = measuredRuns) {
  // Warm-up
  for (let i = 0; i < warmupRuns; i++) {
    try { fn(); } catch (e) {}
  }
  // Measured runs
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    try { fn(); } catch (e) { throw e; }
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // ms
  }
  const sum = times.reduce((a,b) => a+b, 0);
  const avg = sum / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { avg, min, max, times };
}

// Setup test directory
const testDir = path.join(os.tmpdir(), 'quick-memo-bench');
const testDataPath = path.join(testDir, 'notes.json');
const indexPath = path.join(testDir, 'index.json');

// Clean and prepare
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log(`\n🚀 Quick Memo Search Benchmark`);
console.log(`Dataset: ${notesCount.toLocaleString()} notes`);
console.log(`Runs: ${measuredRuns} measured (${warmupRuns} warm-up)`);
console.log('─'.repeat(60));

// Generate synthetic notes
console.log(`\nGenerating ${notesCount} synthetic notes...`);
const notes = [];
const sampleContents = [
  'Meeting with team to discuss project timeline',
  'Buy groceries: milk, eggs, bread',
  'Project deadline is next Friday',
  'Call client about the proposal',
  'Read book: Atomic Habits',
  'Team lunch at 12:30 PM',
  'Submit expense report',
  'Review pull requests',
  'Update documentation',
  'Fix bug in authentication module'
];
const sampleTags = [['work'], ['personal'], ['urgent'], ['meeting'], ['reading'], ['health'], ['admin'], ['code'], ['docs'], ['bug']];

for (let i = 0; i < notesCount; i++) {
  const template = sampleContents[i % sampleContents.length];
  const variation = i < sampleContents.length ? '' : ` #${i+1}`;
  notes.push({
    id: `note_${i}`,
    content: template + variation,
    tags: sampleTags[i % sampleTags.length],
    createdAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000), // random within 30 days
    updatedAt: null
  });
}

// Write to file
const store = new Store(testDataPath);
store.saveNotes(notes);
console.log(`✅ Stored ${notesCount} notes at ${testDataPath}`);

// Build index
console.log('\nBuilding index...');
const index = indexer.buildIndex(notes, testDataPath);
indexer.saveIndex(index, indexPath);
console.log(`✅ Index built with ${index.noteCount} notes (${index.notes.length} entries)`);

// Benchmark scenarios
console.log('\n📊 Benchmark Results (average over ' + measuredRuns + ' runs, ms):\n');

// Helper to format result line
function formatResult(name, result) {
  console.log(`${name.padEnd(30)} avg: ${result.avg.toFixed(3).padStart(8)}  min: ${result.min.toFixed(3).padStart(8)}  max: ${result.max.toFixed(3).padStart(8)}`);
}

// Scenario 1: Full scan without index (Store.getNotes each time)
console.log('Without Index (full file read + parse)');
// Note: reading file each search is the baseline. The index optimization avoids file I/O.
const fullScanResults = benchmark(() => {
  const allNotes = store.getNotes();
  const query = 'meeting';
  const qLower = query.toLowerCase();
  const filtered = allNotes.filter(n => n.content.toLowerCase().includes(qLower));
  return filtered;
});
formatResult('Exact search (full scan)', fullScanResults);

// Scenario 2: Using index (in-memory)
console.log('\nWith Index (in-memory)');
// Load index once (like search command does)
const loadedIndex = indexer.loadIndex(indexPath);
const indexedNotes = indexer.getIndexedNotes(loadedIndex);

const indexExactResults = benchmark(() => {
  const query = 'meeting';
  const qLower = query.toLowerCase();
  const filtered = indexedNotes.filter(n => n.contentLower.includes(qLower));
  return filtered;
});
formatResult('Exact search (index)', indexExactResults);

const indexFuzzyResults = benchmark(() => {
  const query = 'meet';
  const threshold = 0.3;
  const qLower = query.toLowerCase();
  const scored = indexedNotes.map(note => ({
    note,
    score: stringSimilarity.compareTwoStrings(qLower, note.contentLower)
  }));
  const filtered = scored.filter(s => s.score >= threshold).sort((a,b) => b.score - a.score);
  return filtered;
});
formatResult('Fuzzy search (index)', indexFuzzyResults);

// Compare ratios
console.log('\n📈 Performance Gains:');
const exactSpeedup = fullScanResults.avg / indexExactResults.avg;
const fuzzySpeedup = fullScanResults.avg / indexFuzzyResults.avg;
console.log(`Exact search speedup:      ${exactSpeedup.toFixed(2)}x`);
console.log(`Fuzzy search speedup:      ${fuzzySpeedup.toFixed(2)}x`);
console.log(`Index storage overhead:   ${(index.notes.length * JSON.stringify(index.notes[0]).length / 1024).toFixed(1)} KB (approx)`);

// Summary insights
console.log('\n💡 Insights:');
console.log('- The index eliminates file I/O and JSON parsing on every search.');
console.log('- For large datasets (10K+ notes), in-memory index provides significant speedups.');
console.log('- Fuzzy search benefits from precomputed contentLower, avoiding repeated toLowerCase calls.');
console.log('- Index size is modest (stores all note data plus precomputed lowercased content).');

// Cleanup? Keep for manual inspection if needed. We'll leave it.
console.log('\n✅ Benchmark complete. Files left at:', testDir);
