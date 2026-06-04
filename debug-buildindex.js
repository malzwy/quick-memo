const indexer = require('./src/lib/indexer');
const { buildIndex } = indexer;

async function testBuild(notes, notesPath) {
  try {
    const result = await buildIndex(notes, notesPath);
    console.log('Build succeeded:');
    console.log('  notes length:', result.notes?.length);
    console.log('  tokenMap keys:', Object.keys(result.tokenMap || {}).length);
    return result;
  } catch (err) {
    console.error('Build failed:', err);
    console.error('Stack:', err.stack);
    // Check notes shape
    console.log('Input notes shape:');
    console.log('  Array.isArray:', Array.isArray(notes));
    console.log('  length:', notes?.length);
    if (notes?.length > 0) {
      console.log('  first note:', JSON.stringify(notes[0]));
    }
    throw err;
  }
}

// Test with simple data
const simpleNotes = [
  { id: '1', content: 'Hello world', tags: [], createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Another note', tags: ['test'], createdAt: Date.now(), updatedAt: Date.now() }
];

const os = require('os');
const path = require('path');
const fs = require('fs');
const testDir = path.join(os.tmpdir(), 'quick-memo-buildindex-test');
const testDataPath = path.join(testDir, 'notes.json');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
fs.mkdirSync(testDir, { recursive: true });

console.log('=== Test 1: Simple sequential build ===');
testBuild(simpleNotes, testDataPath).then(() => {
  console.log('\n=== Test 2: Force parallel build (>=1000) ===');
  const manyNotes = Array.from({ length: 1000 }, (_, i) => ({
    id: `id${i}`,
    content: `Note ${i}`,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  testBuild(manyNotes, testDataPath).then(() => {
    console.log('All tests complete');
  });
});
