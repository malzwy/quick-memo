#!/usr/bin/env node
/**
 * Quick Memo Compact Storage Benchmark
 * Compare file size and write speed between pretty-printed and compact JSON.
 */

const Store = require('./src/lib/store');
const { generateId } = require('./src/lib/utils');
const fs = require('fs');
const path = require('path');

const NUM_NOTES = 5000;
const TEST_DIR = '/tmp/quick-memo-compact-bench';

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
      content: `Note ${i}: ${randomString(150)}`,
      tags: [`tag${i % 15}`, `${i % 2 === 0 ? 'other' : 'misc'}`],
      createdAt: Date.now() - Math.floor(Math.random() * 1000000000)
    });
  }
  return notes;
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
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
  console.log('\\n=== Quick Memo Compact Storage Benchmark ===\\n');

  // Cleanup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const notes = generateNotes(NUM_NOTES);
  console.log(`Generated ${NUM_NOTES} notes (average ${notes[0].content.length} chars/note).`);

  // Test PRETTY mode (default)
  const prettyPath = path.join(TEST_DIR, 'notes-pretty.json');
  delete process.env.QUICK_MEMO_COMPACT;
  const storePretty = new Store(prettyPath);
  console.log('\\n--- Pretty Print (2-space indent) ---');
  const writePretty = timeOperation('  Write', () => {
    storePretty.replaceAll(notes);
  });
  const prettySize = getFileSize(prettyPath);
  console.log(`  File size: ${formatBytes(prettySize)}`);

  // Test COMPACT mode
  const compactPath = path.join(TEST_DIR, 'notes-compact.json');
  process.env.QUICK_MEMO_COMPACT = '1';
  const storeCompact = new Store(compactPath);
  console.log('\\n--- Compact (no indent) ---');
  const writeCompact = timeOperation('  Write', () => {
    storeCompact.replaceAll(notes);
  });
  const compactSize = getFileSize(compactPath);
  console.log(`  File size: ${formatBytes(compactSize)}`);

  // Summary
  const sizeReduction = ((prettySize - compactSize) / prettySize * 100).toFixed(1);
  const speedup = (writePretty / writeCompact).toFixed(2);
  console.log('\\n=== Comparison ===');
  console.log(`Size reduction: ${sizeReduction}%`);
  console.log(`Write speedup: ${speedup}x`);
  console.log(`\\nNote: Compact mode trades human readability for performance and storage efficiency.`);

  // Cleanup
  fs.rmSync(TEST_DIR, { recursive: true });
}

main().catch(console.error);
