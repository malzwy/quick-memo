const fc = require('fast-check');
const path = require('path');
const os = require('os');
const fs = require('fs');
const indexer = require('./src/lib/indexer');
const { generateId } = require('./src/lib/utils');

const testDir = path.join(os.tmpdir(), 'quick-memo-debug3');
const testDataPath = path.join(testDir, 'notes.json');

function resetTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

// Same noteArb
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

// Run many random runs and log any invalid shapes
let runs = 0;
fc.sample(notesArb, { seed: 12345, size: 1000 }).forEach((notes, idx) => {
  runs++;
  // Check shape
  if (!Array.isArray(notes)) {
    console.error(`Run ${idx}: notes is not array, type=${typeof notes}`);
    return;
  }
  if (notes.length === 0) {
    console.error(`Run ${idx}: notes array is empty`);
    return;
  }
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n || typeof n !== 'object' || Array.isArray(n)) {
      console.error(`Run ${idx}: note ${i} invalid:`, typeof n, JSON.stringify(n));
      return;
    }
    if (typeof n.id !== 'string' || n.id.length === 0) {
      console.error(`Run ${idx}: note ${i} invalid id:`, n.id);
      return;
    }
    if (typeof n.content !== 'string') {
      console.error(`Run ${idx}: note ${i} invalid content:`, typeof n.content);
      return;
    }
    if (!Array.isArray(n.tags)) {
      console.error(`Run ${idx}: note ${i} invalid tags:`, typeof n.tags);
      return;
    }
  }
  // Also test buildIndex
  resetTestDir();
  (async () => {
    try {
      const index = await indexer.buildIndex(notes, testDataPath);
      if (index.notes.length !== notes.length) {
        console.error(`Run ${idx}: index length mismatch: ${index.notes.length} vs ${notes.length}`);
      }
    } catch (err) {
      console.error(`Run ${idx}: buildIndex error:`, err.message);
    }
  })();
});

console.log(`Completed ${runs} runs, check for errors above.`);
