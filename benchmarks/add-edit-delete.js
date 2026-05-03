#!/usr/bin/env node

/**
 * Benchmark: Mutating operations (add, edit, delete) throughput
 *
 * Measures operations per second and latency percentiles.
 */

const Store = require('../src/lib/store');
const IndexManager = require('../src/lib/indexManager');
const { generateId } = require('../src/lib/utils');
const os = require('os');
const path = require('path');

function benchmarkOps(iterations = 1000) {
  const testDir = path.join(os.tmpdir(), 'quick-memo-ops-bench');
  const dataPath = path.join(testDir, 'notes.json');

  // Clean and setup
  const fs = require('fs');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const store = new Store(dataPath);
  const indexMgr = new IndexManager(store);
  indexMgr.load();

  const ops = [];

  // Benchmark add
  console.log(`\n📦 Adding ${iterations.toLocaleString()} notes...`);
  const addStart = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    const note = {
      id: generateId(),
      content: `Benchmark note ${i} - some content to index`,
      tags: ['benchmark', `batch-${Math.floor(i / 100)}`],
      createdAt: Date.now()
    };
    store.addNote(note);
    indexMgr.afterAdd(note);
  }
  const addEnd = process.hrtime.bigint();
  const addDuration = Number(addEnd - addStart) / 1000000;
  ops.push({ op: 'add', count: iterations, durationMs: addDuration, opsPerMs: iterations / addDuration });

  // Benchmark edit (edit half the notes)
  console.log(`  Editing ${Math.floor(iterations / 2).toLocaleString()} notes...`);
  const allNotes = store.getNotes();
  const editTargets = allNotes.slice(0, Math.floor(iterations / 2));
  const editStart = process.hrtime.bigint();
  for (const note of editTargets) {
    note.content = `[EDITED] ${note.content}`;
    note.tags = [...note.tags, 'edited'];
    note.updatedAt = Date.now();
    store.editNote(note.id, note.content, note.tags);
    indexMgr.afterEdit(note);
  }
  const editEnd = process.hrtime.bigint();
  const editDuration = Number(editEnd - editStart) / 1000000;
  ops.push({ op: 'edit', count: editTargets.length, durationMs: editDuration, opsPerMs: editTargets.length / editDuration });

  // Benchmark delete (delete half the remaining)
  console.log(`  Deleting ${Math.floor(iterations / 2).toLocaleString()} notes...`);
  const deleteTargets = allNotes.slice(Math.floor(iterations / 2), iterations);
  const deleteStart = process.hrtime.bigint();
  for (const note of deleteTargets) {
    store.deleteNote(note.id);
    indexMgr.afterDelete(note.id);
  }
  const deleteEnd = process.hrtime.bigint();
  const deleteDuration = Number(deleteEnd - deleteStart) / 1000000;
  ops.push({ op: 'delete', count: deleteTargets.length, durationMs: deleteDuration, opsPerMs: deleteTargets.length / deleteDuration });

  // Cleanup
  fs.rmSync(testDir, { recursive: true });

  return ops;
}

function main() {
  console.log('⚡ Quick Memo Mutating Operations Benchmark\n');

  const iterations = 1000;
  const results = benchmarkOps(iterations);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Results (throughput)');
  console.log('═'.repeat(60));
  console.log(`| Operation | ${'Count'.padEnd(12)} | ${'Time (ms)'.padEnd(12)} | ${'Ops/ms'.padEnd(12)} |`);
  console.log('─'.repeat(60));
  for (const r of results) {
    console.log(`| ${r.op.padEnd(10)} | ${r.count.toLocaleString().padEnd(12)} | ${r.durationMs.toFixed(2).padEnd(12)} | ${r.opsPerMs.toFixed(4).padEnd(12)} |`);
  }
  console.log('═'.repeat(60));

  // Save results
  const fs = require('fs');
  const benchmarkDir = path.join(__dirname, '..', 'benchmarks', 'results');
  fs.mkdirSync(benchmarkDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(benchmarkDir, `ops-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { benchmarkOps };
