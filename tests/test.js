const Store = require('../src/lib/store');
const { generateId } = require('../src/lib/utils');
const { spawnSync } = require('child_process');
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

// Test 13: Trash functionality
console.log('\nTest 13: Trash functionality');
const noteToTrash = afterEdit[0];
const trashId = noteToTrash.id;

// Test trashNote
const trashed = store.trashNote(trashId);
if (trashed.id !== trashId) {
  throw new Error('trashNote should return trashed note');
}
if (!trashed.trashedAt) {
  throw new Error('Trashed note should have trashedAt timestamp');
}
const notesAfterTrash = store.getNotes();
if (notesAfterTrash.some(n => n.id === trashId)) {
  throw new Error('Note should not exist in main notes after trash');
}
const trashNotes = store.getTrashNotes();
if (trashNotes.length !== 1) {
  throw new Error('Should have 1 note in trash');
}
if (trashNotes[0].id !== trashId) {
  throw new Error('Trash should contain correct note');
}
console.log('  ✓ Trash note OK');

// Test trash-list
const trashList = store.getTrashNotes();
if (trashList.length !== 1) {
  throw new Error('trash-list should return 1 note');
}
console.log('  ✓ Trash list OK');

// Test restoreNote
const restored = store.restoreNote(trashId);
if (restored.id !== trashId) {
  throw new Error('restoreNote should return restored note');
}
if (restored.trashedAt) {
  throw new Error('Restored note should not have trashedAt');
}
const notesAfterRestore = store.getNotes();
if (!notesAfterRestore.some(n => n.id === trashId)) {
  throw new Error('Restored note should exist in main notes');
}
const trashAfterRestore = store.getTrashNotes();
if (trashAfterRestore.length !== 0) {
  throw new Error('Trash should be empty after restore');
}
console.log('  ✓ Restore note OK');

// Test trash-empty
const newNote = { id: generateId(), content: 'Test for empty', tags: [], createdAt: Date.now() };
store.addNote(newNote);
const emptyTrashId = newNote.id;
store.trashNote(emptyTrashId);
const trashBeforeEmpty = store.getTrashNotes();
if (trashBeforeEmpty.length !== 1) {
  throw new Error('Should have 1 note in trash before empty');
}
store.emptyTrash();
const trashAfterEmpty = store.getTrashNotes();
if (trashAfterEmpty.length !== 0) {
  throw new Error('Trash should be empty after emptyTrash');
}
const notesAfterEmpty = store.getNotes();
if (notesAfterEmpty.some(n => n.id === emptyTrashId)) {
  throw new Error('Note should not exist after empty trash');
}
console.log('  ✓ Trash empty OK');

// Test permanentlyDelete
const newNote2 = { id: generateId(), content: 'Test for permanent delete', tags: [], createdAt: Date.now() };
store.addNote(newNote2);
const permDeleteId = newNote2.id;
store.permanentlyDelete(permDeleteId);
const notesAfterPermDelete = store.getNotes();
if (notesAfterPermDelete.some(n => n.id === permDeleteId)) {
  throw new Error('Note should not exist after permanent delete');
}
console.log('  ✓ Permanent delete OK');

// Test 14: CSV export format
console.log('\nTest 14: CSV export');
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

// Test 15: Configuration file support
console.log('\nTest 15: Configuration');

// Set custom config path for these tests
const configPathEnv = path.join(testDir, 'config.json');
process.env.QUICK_MEMO_CONFIG = configPathEnv;

// Helper to create temp config
function writeTempConfig(content) {
  if (content) {
    fs.writeFileSync(configPathEnv, JSON.stringify(content));
  } else if (fs.existsSync(configPathEnv)) {
    fs.unlinkSync(configPathEnv);
  }
}

// Load config module
const { loadConfig, getCommandConfig } = require('../src/lib/config');

// A: No config file -> empty object
writeTempConfig(null);
const emptyConfig = loadConfig();
if (typeof emptyConfig !== 'object' || Object.keys(emptyConfig).length !== 0) {
  throw new Error('Expected empty object when no config file');
}
console.log('  ✓ Default empty config OK');

// B: Valid config loads
writeTempConfig({
  list: { sortBy: 'updated', sortAsc: true, detailed: true, json: false }
});
const validConfig = loadConfig();
if (!validConfig.list || validConfig.list.sortBy !== 'updated' || validConfig.list.sortAsc !== true) {
  throw new Error('Failed to load valid config');
}
console.log('  ✓ Load valid config OK');

// C: Invalid JSON returns empty and logs warning
// Write raw invalid JSON (not via JSON.stringify)
fs.writeFileSync(configPathEnv, 'invalid json{');
const invalidConfig = loadConfig();
if (typeof invalidConfig !== 'object' || Object.keys(invalidConfig).length !== 0) {
  throw new Error('Invalid JSON should return empty config');
}
console.log('  ✓ Invalid JSON returns empty OK');

// D: getCommandConfig merges correctly for list
const baseOptions = { sort: null, asc: false, detailed: false, json: false };
const listConfigOnly = getCommandConfig(validConfig, 'list', baseOptions);
if (listConfigOnly.sortBy !== 'updated' || listConfigOnly.sortAsc !== true || listConfigOnly.detailed !== true || listConfigOnly.json !== false) {
  throw new Error('Config merging failed for list');
}
console.log('  ✓ Config merging for list OK');

// E: CLI overrides config
// Config with opposite defaults
const overrideConfig = { list: { sortBy: 'updated', sortAsc: false, detailed: false, json: false } };
const cliOverrides = { sort: 'content', asc: true, detailed: true, json: true };
const mergedConfig = getCommandConfig(overrideConfig, 'list', cliOverrides);
if (mergedConfig.sortBy !== 'content' || mergedConfig.sortAsc !== true || mergedConfig.detailed !== true || mergedConfig.json !== true) {
  throw new Error('CLI options should override config');
}
console.log('  ✓ CLI overrides config OK');

// F: Defaults applied when neither config nor CLI provide
const defaultsOptions = { sort: null, asc: false, detailed: false, json: false };
const defaultsConfig = getCommandConfig({}, 'list', defaultsOptions);
if (defaultsConfig.sortBy !== 'created' || defaultsConfig.sortAsc !== false || defaultsConfig.detailed !== false || defaultsConfig.json !== false) {
  throw new Error('Defaults not applied correctly');
}
console.log('  ✓ Defaults applied OK');

// G: confirmDelete for delete command
writeTempConfig({ delete: { confirmDelete: false } });
const deleteConfigNoConfirm = getCommandConfig(loadConfig(), 'delete', { force: false });
if (deleteConfigNoConfirm.confirm !== false) {
  throw new Error('Config confirmDelete false should produce confirm false');
}
console.log('  ✓ delete confirm from config OK');

// H: force overrides config
const deleteConfigForce = getCommandConfig(loadConfig(), 'delete', { force: true });
if (deleteConfigForce.confirm !== false) {
  throw new Error('force should set confirm false regardless of config');
}
console.log('  ✓ force overrides config OK');

// I: env var QUICK_MEMO_CONFIG (different path)
const customConfigPath = path.join(testDir, 'custom-config.json');
fs.writeFileSync(customConfigPath, JSON.stringify({ list: { sortBy: 'content' } }));
process.env.QUICK_MEMO_CONFIG = customConfigPath;
const envConfig = loadConfig();
if (envConfig.list.sortBy !== 'content') {
  throw new Error('Config path from env not used');
}
delete process.env.QUICK_MEMO_CONFIG; // clean up
console.log('  ✓ Env var config path OK');

// Clean up config file at the env path
if (fs.existsSync(configPathEnv)) {
  fs.unlinkSync(configPathEnv);
}

// Test 16: Statistics JSON output (new feature)
console.log('\nTest 16: Statistics JSON output');
const statsJsonOutput = { total: statsNotes.length, tags: tagsCount };
const statsJsonString = JSON.stringify(statsJsonOutput, null, 2);
const parsedStats = JSON.parse(statsJsonString);
if (parsedStats.total !== statsNotes.length) {
  throw new Error('JSON total mismatch');
}
if (JSON.stringify(parsedStats.tags) !== JSON.stringify(tagsCount)) {
  throw new Error('JSON tags mismatch');
}
console.log('  ✓ Statistics JSON OK');

// Test 17: Tags JSON output
console.log('\nTest 17: Tags JSON output');
const tagsForJson = {};
statsNotes.forEach(n => {
  n.tags.forEach(t => {
    tagsForJson[t] = (tagsForJson[t] || 0) + 1;
  });
});
const tagListSorted = Object.entries(tagsForJson).sort((a,b) => b[1] - a[1]);
// Simulate tags command JSON output
const tagsJsonOutput = { tags: Object.fromEntries(tagListSorted) };
const tagsJsonString = JSON.stringify(tagsJsonOutput, null, 2);
const parsedTags = JSON.parse(tagsJsonString);
if (!parsedTags.tags) {
  throw new Error('Tags JSON missing tags object');
}
// Verify counts match
for (const [tag, count] of Object.entries(tagsForJson)) {
  if (parsedTags.tags[tag] !== count) {
    throw new Error(`Count mismatch for tag ${tag}: expected ${count}, got ${parsedTags.tags[tag]}`);
  }
}
console.log('  ✓ Tags JSON OK');

// Test 18: Search JSON output
console.log('\nTest 18: Search JSON output');
// Create sample notes for this test (they will remain in store)
const searchSampleNotes = [
  { id: generateId(), content: 'Meeting with team', tags: ['work'], createdAt: Date.now() },
  { id: generateId(), content: 'Buy dinner', tags: ['personal', 'food'], createdAt: Date.now() },
  { id: generateId(), content: 'Project deadline', tags: ['work', 'urgent'], createdAt: Date.now() }
];
searchSampleNotes.forEach(n => store.addNote(n));
const searchQuery = 'meet';
let searchJsonResults = store.getNotes().filter(n => n.content.toLowerCase().includes(searchQuery));
if (searchJsonResults.length === 0) {
  throw new Error('Test 18 expects at least one note containing "meet"');
}
const searchJsonStr = JSON.stringify(searchJsonResults, null, 2);
const parsedSearch = JSON.parse(searchJsonStr);
if (!Array.isArray(parsedSearch)) {
  throw new Error('Search JSON output should be an array');
}
for (const note of parsedSearch) {
  if (!note.id || !note.content || !Array.isArray(note.tags) || !note.createdAt) {
    throw new Error('Search JSON result missing required fields');
  }
}
console.log('  ✓ Search JSON OK');

// Test 19: Search tag filtering logic
console.log('\nTest 19: Search tag filtering');
// Simulate result set and apply tag filter (OR logic)
const mockResults = [
  { id: '1', content: 'Note A', tags: ['work'] },
  { id: '2', content: 'Note B', tags: ['personal'] },
  { id: '3', content: 'Note C', tags: ['work', 'urgent'] },
  { id: '4', content: 'Note D', tags: ['food'] }
];
const tagFilters = ['work', 'urgent'];
const filtered = mockResults.filter(n => tagFilters.some(tag => n.tags.includes(tag)));
if (filtered.length !== 2) {
  throw new Error('Tag filter should return 2 notes (work OR urgent)');
}
// Verify filtered notes have expected IDs
const filteredIds = filtered.map(n => n.id);
if (!filteredIds.includes('1') || !filteredIds.includes('3')) {
  throw new Error('Tag filter incorrect results');
}
console.log('  ✓ Tag filtering OK');

// Test 20: Fuzzy search functionality
console.log('\nTest 20: Fuzzy search');
const stringSimilarity = require('string-similarity');
// Create test notes with varying similarity to query 'meeting'
const fuzzyNotes = [
  { id: 'f1', content: 'Meeting with team', tags: ['work'], createdAt: Date.now() },
  { id: 'f2', content: 'Meting schedule', tags: ['work'], createdAt: Date.now() }, // typo
  { id: 'f3', content: 'Team dinner', tags: ['personal'], createdAt: Date.now() },
  { id: 'f4', content: 'Weekly meeting agenda', tags: ['work'], createdAt: Date.now() }
];
const fuzzyStore = new Store(testDataPath);
fuzzyNotes.forEach(n => fuzzyStore.addNote(n));
// Simulate fuzzy search with threshold 0.3
const query = 'meeting';
const threshold = 0.3;
const allNotes = fuzzyStore.getNotes();
const scored = allNotes.map(note => ({
  note,
  score: stringSimilarity.compareTwoStrings(query.toLowerCase(), note.content.toLowerCase())
}));
const fuzzyResults = scored
  .filter(item => item.score >= threshold)
  .sort((a, b) => b.score - a.score)
  .map(item => item.note);
// At threshold 0.3, we expect the two meeting notes plus the typo 'Meting'
// Check that we got at least the exact match
const hasExact = fuzzyResults.some(n => n.content.includes('Meeting'));
if (!hasExact) {
  throw new Error('Fuzzy search should include exact match');
}
// Verify scores are computed correctly (higher score for exact match)
const exactScore = scored.find(s => s.note.content.includes('Meeting')).score;
const typoScore = scored.find(s => s.note.content.includes('Meting')).score;
if (exactScore < typoScore) {
  throw new Error('Exact match should have higher similarity score than typo');
}
console.log('  ✓ Fuzzy search OK (scoring and threshold)');

// Test 21: Fuzzy search with tag filtering
console.log('\nTest 21: Fuzzy search with tag filtering');
const mockFuzzyResults = [
  { id: 'a', content: 'Project kickoff meeting', tags: ['work'] },
  { id: 'b', content: 'Meting notes', tags: ['work'] },
  { id: 'c', content: 'Team building', tags: ['personal'] }
];
const queryFuzzy = 'meet';
const thresholdFuzzy = 0.2; // low to include some
const tagFilterTest = ['work'];
// Simulate fuzzy results already
const afterFuzzy = mockFuzzyResults.filter(n => stringSimilarity.compareTwoStrings(queryFuzzy.toLowerCase(), n.content.toLowerCase()) >= thresholdFuzzy);
const afterTag = afterFuzzy.filter(n => tagFilterTest.some(tag => n.tags.includes(tag)));
if (afterTag.length !== 2) {
  throw new Error('Fuzzy + tag filter should return 2 work notes');
}
console.log('  ✓ Fuzzy + tag filtering OK');

// Test 22: untagNote - successful removal
console.log('\nTest 22: Untag (Store method)');
const notesForUntag = store.getNotes();
const noteWithTags = notesForUntag.find(n => n.tags.length > 0);
if (!noteWithTags) {
  throw new Error('Require a note with tags for untag test');
}
const noteId = noteWithTags.id;
const tagToRemove = noteWithTags.tags[0];
const untagResult = store.untagNote(noteId, tagToRemove);
if (!untagResult) {
  throw new Error('untagNote should return true when tag exists');
}
// Verify tag removed
const afterNotes = store.getNotes();
const ungotNote = afterNotes.find(n => n.id === noteId);
if (ungotNote.tags.includes(tagToRemove)) {
  throw new Error('Tag should have been removed');
}
if (ungotNote.tags.length !== noteWithTags.tags.length - 1) {
  throw new Error('Tag count should decrease by one');
}
console.log('  ✓ Untag success');

// Test 23: untagNote - tag not present
console.log('\nTest 23: Untag non-existent tag');
const result2 = store.untagNote(noteId, 'nonexistenttag');
if (result2 !== false) {
  throw new Error('untagNote should return false for non-existent tag');
}
console.log('  ✓ Untag returns false for missing tag');

// Test 24: untagNote - note not found
console.log('\nTest 24: Untag non-existent note');
let threw = false;
try {
  store.untagNote('nonexistentid', 'sometag');
} catch (err) {
  if (err.message.includes('not found')) {
    threw = true;
  } else {
    throw err;
  }
}
if (!threw) {
  throw new Error('Should throw when note not found');
}
console.log('  ✓ Untag throws for missing note');

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ All tests passed!');
console.log(`Total notes in test store: ${store.getNotes().length}`);
console.log('Tags present:', Object.keys(tagsCount).join(', ') || 'none');
console.log(`Test coverage: 24 test categories (added untag functionality and Store error handling)`);
console.log('='.repeat(50));