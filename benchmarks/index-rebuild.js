#!/usr/bin/env node

/**
 * Benchmark: Index rebuild performance
 *
 * Measures time to build search index from notes array.
 * Useful for profiling large datasets (10k, 100k notes).
 */

const { buildIndex, computeRev } = require('../src/lib/indexer');
const os = require('os');
const path = require('path');

function generateNotes(count) {
  const notes = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: `note-${i}`,
      content: `This is test note number ${i} with some content for indexing ${i % 10 === 0 ? 'important' : ''}`,
      tags: i % 3 === 0 ? ['test', 'benchmark'] : ['note'],
      createdAt: Date.now() - Math.floor(Math.random() * 1000000000),
      updatedAt: i % 2 === 0 ? Date.now() : null
    });
  }
  return notes;
}

function benchmarkRebuild(notes, notesPath) {
  const start = process.hrtime.bigint();
  const index = buildIndex(notes, notesPath);
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1000000;
  return {
    noteCount: notes.length,
    indexSize: JSON.stringify(index).length,
    durationMs,
    notesPerMs: notes.length / durationMs
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function main() {
  console.log('⚡ Quick Memo Index Rebuild Benchmark\n');

  const notesPath = '/tmp/quick-memo-benchmark/notes.json';

  // Test different dataset sizes
  const sizes = [100, 1000, 10000, 50000, 100000];
  const results = [];

  for (const size of sizes) {
    console.log(`Generating ${size.toLocaleString()} test notes...`);
    const notes = generateNotes(size);

    console.log(`Benchmarking ${size.toLocaleString()} notes...`);
    const result = benchmarkRebuild(notes, notesPath);
    results.push(result);

    console.log(`  Duration: ${result.durationMs.toFixed(2)} ms`);
    console.log(`  Index size: ${formatBytes(result.indexSize)}`);
    console.log(`  Throughput: ${result.notesPerMs.toFixed(2)} notes/ms`);
    console.log('');
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('📊 Results Summary');
  console.log('═'.repeat(50));
  console.log(`| ${'Notes'.padEnd(12)} | ${'Time (ms)'.padEnd(12)} | ${'Size'.padEnd(12)} | ${'Notes/ms'.padEnd(12)} |`);
  console.log('─'.repeat(70));
  for (const r of results) {
    console.log(`| ${r.noteCount.toLocaleString().padEnd(12)} | ${r.durationMs.toFixed(2).padEnd(12)} | ${formatBytes(r.indexSize).padEnd(12)} | ${r.notesPerMs.toFixed(2).padEnd(12)} |`);
  }
  console.log('═'.repeat(50));

  // Save baseline
  const fs = require('fs');
  const benchmarkDir = path.join(__dirname, '..', 'benchmarks', 'results');
  fs.mkdirSync(benchmarkDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(benchmarkDir, `index-rebuild-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { benchmarkRebuild, generateNotes };
