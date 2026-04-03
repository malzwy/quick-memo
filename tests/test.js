const Store = require('../src/lib/store');
const { generateId } = require('../src/lib/utils');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Setup test directory
const testDir = path.join(os.tmpdir(), 'quick-memo-test');
const testDataPath = path.join(testDir, 'notes.json');

// Clean previous test
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

const store = new Store(testDataPath);

// Test adding notes
const note1 = { id: generateId(), content: 'Test note one', tags: ['test'], createdAt: Date.now() };
store.addNote(note1);

const note2 = { id: generateId(), content: 'Another test note', tags: ['work', 'important'], createdAt: Date.now() };
store.addNote(note2);

// Test listing
let notes = store.getNotes();
if (notes.length !== 2) {
  throw new Error(`Expected 2 notes, got ${notes.length}`);
}

// Test search
const searchResults = notes.filter(n => n.content.toLowerCase().includes('test'));
if (searchResults.length !== 2) {
  throw new Error('Search should find both notes with "test"');
}

const searchResults2 = notes.filter(n => n.content.toLowerCase().includes('another'));
if (searchResults2.length !== 1) {
  throw new Error('Search for "another" should find 1 note');
}

// Test stats (just ensure no errors)
const total = notes.length;
const tagsCount = {};
notes.forEach(n => {
  n.tags.forEach(t => {
    tagsCount[t] = (tagsCount[t] || 0) + 1;
  });
});

console.log('✅ All tests passed');
console.log(`Total notes: ${total}`);
console.log('Tags:', tagsCount);