#!/usr/bin/env node

/**
 * Benchmark: Search performance (exact and fuzzy)
 *
 * Measures search latency across different query types and dataset sizes.
 */

const { buildIndex, loadIndex, saveIndex, getIndexPath, needsRebuild } = require('../src/lib/indexer');
const Store = require('../src/lib/store');
const stringSimilarity = require('string-similarity');
const os = require('os');
const path = require('path');

function generateNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    const base = `Test note ${i}`;
    const suffixes = ['important', 'meeting', 'todo', 'reminder', 'work', 'personal'];
    const suffix = suffixes[i % suffixes.length];
    notes.push({
      id: `note-${i}`,
      content: `${base} - ${suffix} details and information`,
      tags: [suffix, i % 2 === 0 ? 'active' : 'inactive'],
      createdAt: Date.now() - Math.floor(Math.random() * 1000000000),
      updatedAt: i % 2 === 0 ? Date.now() : null
    });
  }
  return notes;
}

function benchmarkSearch(notes, queries, fuzzy = false, threshold = 0.3) {
  const results = [];

  for (const query of queries) {
    const start = process.hrtime.bigint();
    let matches = [];

    if (fuzzy) {
      const queryLower = query.toLowerCase();
      const scored = notes.map(note => ({
        note,
        score: stringSimilarity.compareTwoStrings(queryLower, (note.contentLower || note.content).toLowerCase())
      }));
      matches = scored
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map(item => item.note);
    } else {
      const queryLower = query.toLowerCase();
      matches = notes.filter(n => (n.contentLower || n.content).toLowerCase().includes(queryLower));
    }

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;

    results.push({
      query,
      fuzzy,
      threshold,
      matchCount: matches.length,
      durationMs
    });
  }

  return results;
}

function main() {
  console.log('⚡ Quick Memo Search Benchmark\n');

  const sizes = [1000, 10000, 50000];
  const queriesExact = ['test', 'important', 'meeting', 'nonexistent'];
  const queriesFuzzy = ['meating', 'tst', 'inportant', 'memo'];

  const allResults = [];

  for (const size of sizes) {
    console.log(`\n📊 Generating ${size.toLocaleString()} notes...`);
    const notes = generateNotes(size);
    const tmpDir = path.join(os.tmpdir(), 'quick-memo-search-bench');
    const dataPath = path.join(tmpDir, `notes-${size}.json`);
    const indexPath = path.join(tmpDir, `index-${size}.json`);

    // Write notes
    const fs = require('fs');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(notes, null, 0));
    console.log(`  Saved ${notes.length} notes`);

    // Build and save index
    console.log('  Building index...');
    const index = buildIndex(notes, dataPath);
    saveIndex(index, indexPath);
    console.log(`  Index size: ${JSON.stringify(index).length} bytes`);

    // Benchmark exact search
    console.log('\n 🔍 Exact search:');
    const exactResults = benchmarkSearch(index.notes, queriesExact, false);
    for (const r of exactResults) {
      console.log(`    "${r.query}" → ${r.matchCount} matches in ${r.durationMs.toFixed(3)}ms`);
    }
    allResults.push({ size, type: 'exact', results: exactResults });

    // Benchmark fuzzy search
    console.log('  🔍 Fuzzy search (threshold 0.3):');
    const fuzzyResults = benchmarkSearch(index.notes, queriesFuzzy, true, 0.3);
    for (const r of fuzzyResults) {
      console.log(`    "${r.query}" → ${r.matchCount} matches in ${r.durationMs.toFixed(3)}ms`);
    }
    allResults.push({ size, type: 'fuzzy', results: fuzzyResults });
  }

  // Summary table
  console.log('\n' + '═'.repeat(80));
  console.log('📈 Search Latency Summary (ms)');
  console.log('═'.repeat(80));
  console.log('| Dataset | Query Type | Query       | Matches | Latency (ms) |');
  console.log('─'.repeat(80));
  for (const entry of allResults) {
    for (const r of entry.results) {
      console.log(`| ${entry.size.toLocaleString().padEnd(8)} | ${r.fuzzy ? 'fuzzy   ' : 'exact   '} | ${r.query.padEnd(11)} | ${r.matchCount.toString().padEnd(7)} | ${r.durationMs.toFixed(3).padEnd(13)} |`);
    }
  }
  console.log('═'.repeat(80));

  // Save results
  const fs = require('fs');
  const benchmarkDir = path.join(__dirname, '..', 'benchmarks', 'results');
  fs.ensureDirSync(benchmarkDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(benchmarkDir, `search-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nDetailed results saved to: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { benchmarkSearch, generateNotes };
