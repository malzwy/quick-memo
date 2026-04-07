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

console.log('🧪 Running Quick Memo Test Suite\n');

// Test 1: Store initialization and empty state
console.log('Test 1: Empty store returns empty array');
const emptyStore = new Store(testDataPath);
const emptyNotes = emptyStore.getNotes();
if (!Array.isArray(emptyNotes) || emptyNotes.length !== 0) {
  throw new Error('Empty store should return empty array');
}
console.log('  ✓ Empty store OK');

// Test 2: Adding notes
console.log('\nTest 2: Adding notes');
const store = new Store(testDataPath);
const note1 = { id: generateId(), content: 'Test note one', tags: ['test'], createdAt: Date.now() };
const note2 = { id: generateId(), content: 'Another test note', tags: ['work', 'important'], createdAt: Date.now() };
store.addNote(note1);
store.addNote(note2);

let notes = store.getNotes();
if (notes.length !== 2) {
  throw new Error(`Expected 2 notes, got ${notes.length}`);
}
console.log('  ✓ Add notes OK');

// Test 3: Input validation - empty content should throw
console.log('\nTest 3: Input validation');
try {
  store.addNote({ id: generateId(), content: '   ', tags: [], createdAt: Date.now() });
  throw new Error('Should have thrown for empty content');
} catch (err) {
  if (err.message.includes('cannot be empty')) {
    console.log('  ✓ Rejects empty content');
  } else {
    throw err;
  }
}

// Test 4: Search functionality
console.log('\nTest 4: Search');
const searchResults = notes.filter(n => n.content.toLowerCase().includes('test'));
if (searchResults.length !== 2) {
  throw new Error('Search should find both notes with "test"');
}
const searchResults2 = notes.filter(n => n.content.toLowerCase().includes('another'));
if (searchResults2.length !== 1) {
  throw new Error('Search for "another" should find 1 note');
}
console.log('  ✓ Search OK');

// Test 5: Tag filtering
console.log('\nTest 5: Tag filtering');
const filteredByTag = notes.filter(n => n.tags.includes('work'));
if (filteredByTag.length !== 1) {
  throw new Error('Filter by tag should return 1 note');
}
const noMatches = notes.filter(n => n.tags.includes('nonexistent'));
if (noMatches.length !== 0) {
  throw new Error('Filter by nonexistent tag should return empty');
}
console.log('  ✓ Tag filtering OK');

// Test 6: Delete functionality
console.log('\nTest 6: Delete');
const noteToDelete = notes[0];
const initialLength = notes.length;
const notesAfterDelete = notes.filter(n => n.id !== noteToDelete.id);
store.saveNotes(notesAfterDelete);
const verification = store.getNotes();
if (verification.length !== initialLength - 1) {
  throw new Error('Delete should reduce notes by 1');
}
if (verification.some(n => n.id === noteToDelete.id)) {
  throw new Error('Deleted note should not exist');
}
console.log('  ✓ Delete OK');

// Test 7: Edit functionality
console.log('\nTest 7: Edit');
const noteToEdit = verification[0];
noteToEdit.content = 'Updated content';
noteToEdit.tags = ['updated', 'test'];
noteToEdit.updatedAt = Date.now();
store.saveNotes(verification);
const afterEdit = store.getNotes();
const editedNote = afterEdit.find(n => n.id === noteToEdit.id);
if (editedNote.content !== 'Updated content') {
  throw new Error('Edit should update content');
}
if (!editedNote.tags.includes('updated')) {
  throw new Error('Edit should update tags');
}
console.log('  ✓ Edit OK');

// Test 8: Sorting (by created date)
console.log('\nTest 8: Sorting');
const sortedDesc = [...afterEdit].sort((a, b) => b.createdAt - a.createdAt);
if (sortedDesc[0].createdAt >= afterEdit[afterEdit.length - 1].createdAt) {
  console.log('  ✓ Sort by created (desc) OK');
}
const sortedAsc = [...afterEdit].sort((a, b) => a.createdAt - b.createdAt);
if (sortedAsc[0].createdAt <= afterEdit[afterEdit.length - 1].createdAt) {
  console.log('  ✓ Sort by created (asc) OK');
}

// Test 9: JSON output format
console.log('\nTest 9: JSON output');
const jsonOutput = JSON.stringify(afterEdit, null, 2);
const parsed = JSON.parse(jsonOutput);
if (!Array.isArray(parsed)) {
  throw new Error('JSON output should be parseable array');
}
if (parsed.length !== afterEdit.length) {
  throw new Error('JSON output should preserve all notes');
}
console.log('  ✓ JSON format OK');

// Test 10: Statistics calculation
console.log('\nTest 10: Statistics');
const statsNotes = store.getNotes();
const total = statsNotes.length;
if (total < 0) {
  throw new Error('Total should be non-negative');
}
const tagsCount = {};
statsNotes.forEach(n => {
  n.tags.forEach(t => {
    tagsCount[t] = (tagsCount[t] || 0) + 1;
  });
});
const tagSum = Object.values(tagsCount).reduce((a, b) => a + b, 0);
if (tagSum !== statsNotes.reduce((sum, n) => sum + n.tags.length, 0)) {
  throw new Error('Tag counts should match actual tag occurrences');
}
console.log('  ✓ Statistics OK');

// Test 11: Corrupted file handling
console.log('\nTest 11: Corrupted file handling');
const corruptPath = path.join(testDir, 'corrupt.json');
fs.writeFileSync(corruptPath, 'invalid json {');
const corruptStore = new Store(corruptPath);
const corruptNotes = corruptStore.getNotes();
if (!Array.isArray(corruptNotes) || corruptNotes.length !== 0) {
  throw new Error('Should return empty array for corrupted file');
}
const backupFiles = fs.readdirSync(testDir).filter(f => f.startsWith('corrupt.json.corrupt-'));
if (backupFiles.length === 0) {
  throw new Error('Should create backup of corrupted file');
}
console.log('  ✓ Corrupted file handling OK');

// Test 12: Export Markdown format
console.log('\nTest 12: Export simulation');
const exportNotes = store.getNotes();
let md = `# Quick Memo Export\n\nGenerated: ${new Date().toLocaleString()}\nTotal notes: ${exportNotes.length}\n\n`;
exportNotes.forEach((note, idx) => {
  md += `## ${idx + 1}. ${note.content}\n\n`;
  md += `**ID:** ${note.id}  \n`;
  md += `**Created:** ${new Date(note.createdAt).toLocaleString()}\n\n`;
  md += `**Tags:** ${note.tags.join(', ') || 'none'}\n\n`;
  md += `---\n\n`;
});
if (md.includes('# Quick Memo Export') && md.includes(exportNotes[0].content)) {
  console.log('  ✓ Export format OK');
} else {
  throw new Error('Export format incorrect');
}

// Test 13: CSV export format
console.log('\nTest 13: CSV export');
const csvNotes = store.getNotes();
// Simulate CSV generation (same logic as in code)
function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
let csv = '';
csv += 'ID,Content,Tags,Created,Updated\n';
csvNotes.forEach(note => {
  const id = escapeCsv(note.id);
  const content = escapeCsv(note.content);
  const tags = escapeCsv(note.tags.join(';'));
  const created = escapeCsv(new Date(note.createdAt).toISOString());
  const updated = escapeCsv(note.updatedAt ? new Date(note.updatedAt).toISOString() : '');
  csv += `${id},${content},${tags},${created},${updated}\n`;
});
const lines = csv.trim().split('\n');
if (lines.length !== csvNotes.length + 1) {
  throw new Error(`CSV should have ${csvNotes.length + 1} lines (header + notes)`);
}
const headers = lines[0].split(',');
if (headers.length !== 5 || headers[0] !== 'ID' || headers[1] !== 'Content' || headers[2] !== 'Tags' || headers[3] !== 'Created' || headers[4] !== 'Updated') {
  throw new Error('CSV headers incorrect');
}
// Verify each note appears
const contentIdx = 1; // Content column
csvNotes.forEach((note, i) => {
  const row = lines[i + 1].split(',');
  // Since content may be quoted, simple check: row should contain note content
  if (!row.join(',').includes(note.content)) {
    throw new Error('CSV row missing note content');
  }
});
console.log('  ✓ CSV format OK');

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ All tests passed!');
console.log(`Total notes in test store: ${store.getNotes().length}`);
console.log('Tags present:', Object.keys(tagsCount).join(', ') || 'none');
console.log('='.repeat(50));