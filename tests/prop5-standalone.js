(async () => {
const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');

const testDir = path.join(os.tmpdir(), 'quick-memo-prop5-test');
const testDataPath = path.join(testDir, 'notes.json');
const indexPath = path.join(testDir, 'index.json');

function resetTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

resetTestDir();

const Store = require('../src/lib/store');
const IndexManager = require('../src/lib/indexManager');
const indexer = require('../src/lib/indexer');
const { generateId } = require('../src/lib/utils');

function createStore() {
  return new Store(testDataPath);
}

// Arbitrary note generator
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

console.log('\n🧪 Property 5 Standalone Test\n');

let passed = 0;
let failed = 0;

async function runTest() {
  try {
    resetTestDir();
    await fc.assert(fc.asyncProperty(notesArb, async (initialNotes) => {
      if (initialNotes.length === 0) return;
      fs.writeFileSync(testDataPath, JSON.stringify(initialNotes));
      const store = createStore();
      const indexMgr = new IndexManager(store);
      indexMgr.load();
      await indexMgr.rebuild();
      let index = indexMgr.getIndex();
      if (index.notes.length !== initialNotes.length) throw new Error('Initial index mismatch');

      // Perform operations
      const notesCopy = [...initialNotes];
      const numOps = Math.min(notesCopy.length, 10);
      // Do NOT clear generatedIds here

      for (let i = 0; i < numOps; i++) {
        const opType = Math.floor(Math.random() * 3);
        if (opType === 0) {
          // Add
          const newNote = {
            id: generateUniqueId(),
            content: 'New ' + Date.now(),
            tags: ['new'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          store.addNote(newNote);
          await indexMgr.afterAdd(newNote);
          notesCopy.push(newNote);
        } else if (opType === 1 && notesCopy.length > 0) {
          // Edit
          const idx = Math.floor(Math.random() * notesCopy.length);
          const note = notesCopy[idx];
          const edited = { ...note, content: 'Edit ' + Date.now(), updatedAt: Date.now() };
          store.editNote(note.id, edited.content, edited.tags);
          await indexMgr.afterEdit(edited);
          notesCopy[idx] = edited;
        } else if (notesCopy.length > 0) {
          // Delete
          const idx = Math.floor(Math.random() * notesCopy.length);
          const note = notesCopy[idx];
          store.deleteNote(note.id);
          await indexMgr.afterDelete(note.id);
          notesCopy.splice(idx, 1);
        }
      }

      index = indexMgr.getIndex();
      if (index.notes.length !== notesCopy.length) {
        throw new Error(`Length mismatch: index ${index.notes.length} vs notesCopy ${notesCopy.length}`);
      }
      const finalIds = new Set(index.notes.map(n => n.id));
      for (const n of notesCopy) {
        if (!finalIds.has(n.id)) {
          const indexIds = index.notes.map(n => n.id);
          throw new Error(`Missing note ${n.id}. Index IDs: ${indexIds.join(', ')}`);
        }
      }
    }));
    console.log('✓ Property 5 passed');
    passed++;
  } catch (err) {
    console.log('✗ Property 5 failed');
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

await runTest();

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
})();
