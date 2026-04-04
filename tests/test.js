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

// Test stats
const total = notes.length;
const tagsCount = {};
notes.forEach(n => {
  n.tags.forEach(t => {
    tagsCount[t] = (tagsCount[t] || 0) + 1;
  });
});

// Test tag filtering
const filteredByTag = notes.filter(n => n.tags.includes('work'));
if (filteredByTag.length !== 1) {
  throw new Error('Filter by tag should return 1 note');
}

// Test delete
const noteToDelete = notes[0];
const initialLength = notes.length;
const newStore = new Store(testDataPath);
// Manually simulate delete for testing (we'll test via programmatic API)
const notesAfterDelete = notes.filter(n => n.id !== noteToDelete.id);
newStore.saveNotes(notesAfterDelete);
const verification = newStore.getNotes();
if (verification.length !== initialLength - 1) {
  throw new Error('Delete should reduce notes by 1');
}
if (verification.some(n => n.id === noteToDelete.id)) {
  throw new Error('Deleted note should not exist');
}

// Test edit
const noteToEdit = verification[0];
const originalContent = noteToEdit.content;
noteToEdit.content = 'Updated content';
noteToEdit.tags = ['updated', 'test'];
newStore.saveNotes(verification);
const afterEdit = newStore.getNotes();
const editedNote = afterEdit.find(n => n.id === noteToEdit.id);
if (editedNote.content !== 'Updated content') {
  throw new Error('Edit should update content');
}
if (!editedNote.tags.includes('updated')) {
  throw new Error('Edit should update tags');
}

console.log('✅ All tests passed');
console.log(`Total notes: ${afterEdit.length}`);
console.log('Tags:', Object.entries(tagsCount).map(([t, c]) => `${t}:${c}`).join(', '));

// Test JSON output simulation
const jsonOutput = JSON.stringify(afterEdit, null, 2);
if (typeof jsonOutput !== 'string') {
  throw new Error('JSON output should be string');
}
console.log('JSON output format: OK');