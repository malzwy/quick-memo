const fc = require('fast-check');
const path = require('path');
const os = require('os');
const fs = require('fs');
const indexer = require('./src/lib/indexer');
const { generateId } = require('./src/lib/utils');

const testDir = path.join(os.tmpdir(), 'quick-memo-debug2');
const testDataPath = path.join(testDir, 'notes.json');

function resetTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

// Same noteArb as property.test.js
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

// Run property 1 with extra logging on failure
console.log('Testing Property 1 with detailed logging...');

const result = fc.assert(fc.property(notesArb, (notes) => {
  // Log the received notes shape
  if (!Array.isArray(notes)) {
    throw new Error(`Notes is not an array: ${typeof notes}`);
  }
  if (notes.length === 0) {
    throw new Error('Notes array is empty (should have min:1)');
  }
  // Validate each note
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n || typeof n !== 'object') {
      throw new Error(`Note ${i} is not an object: ${typeof n}, value: ${JSON.stringify(n)}`);
    }
    if (typeof n.id !== 'string' || n.id.length === 0) {
      throw new Error(`Note ${i} has invalid id: ${JSON.stringify(n)}`);
    }
    if (typeof n.content !== 'string') {
      throw new Error(`Note ${i} has invalid content type: ${typeof n.content}, value: ${JSON.stringify(n)}`);
    }
  }

  resetTestDir();
  const index = indexer.buildIndex(notes, testDataPath);
  if (index.notes.length !== notes.length) {
    throw new Error(`Length mismatch: index ${index.notes.length} vs notes ${notes.length}`);
  }
  const noteIds = new Set(notes.map(n => n.id));
  const indexIds = new Set(index.notes.map(n => n.id));
  for (const id of indexIds) {
    if (!noteIds.has(id)) throw new Error(`Unknown ID in index: ${id}`);
  }
  for (const id of noteIds) {
    if (!indexIds.has(id)) throw new Error(`Missing ID in index: ${id}`);
  }
}), { seed: 1377810974 });

console.log('Result:', result);
