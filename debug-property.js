(async () => {
const path = require('path');
const os = require('os');
const fs = require('fs');

const testDir = path.join(os.tmpdir(), 'quick-memo-debug');
const testDataPath = path.join(testDir, 'notes.json');

if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

const indexer = require('./src/lib/indexer');
const { generateId } = require('./src/lib/utils');

// Test case 1: empty notes array
console.log('\n=== Test 1: Empty notes array ===');
const emptyNotes = [];
try {
  const index = await indexer.buildIndex(emptyNotes, testDataPath);
  console.log('Index built:', JSON.stringify(index, null, 2));
  console.log('notes.length:', index.notes.length);
  console.log('tokenMap:', index.tokenMap);
} catch (err) {
  console.error('Error:', err);
}

// Test case 2: note with single space content
console.log('\n=== Test 2: Note with space-only content ===');
const spaceNote = [{
  id: generateId(),
  content: ' ',
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
}];
try {
  const index = await indexer.buildIndex(spaceNote, testDataPath);
  console.log('Index built:');
  console.log('  notes.length:', index.notes.length);
  console.log('  note tokens:', index.notes[0]?.tokens);
  console.log('  tokenMap:', index.tokenMap);
  console.log('  Object.keys(tokenMap).length:', Object.keys(index.tokenMap).length);
} catch (err) {
  console.error('Error:', err);
}

// Test case 3: Property test reimplementation with detail
console.log('\n=== Test 3: Full property check with debug ===');
const notes = spaceNote;
fs.writeFileSync(testDataPath, JSON.stringify(notes));
const index = await indexer.buildIndex(notes, testDataPath);
console.log('After buildIndex:');
console.log('  index.notes:', index.notes);
console.log('  index.tokenMap:', index.tokenMap);

// Check 1: Length match
if (index.notes.length !== notes.length) {
  console.error('❌ Length mismatch');
} else {
  console.log('✓ Length match');
}

// Check 2: Bijection - every index note ID exists in notes
const noteIds = new Set(notes.map(n => n.id));
const indexIds = new Set(index.notes.map(n => n.id));
let ok = true;
for (const id of indexIds) {
  if (!noteIds.has(id)) {
    console.error(`❌ Unknown ID in index: ${id}`);
    ok = false;
  }
}
for (const id of noteIds) {
  if (!indexIds.has(id)) {
    console.error(`❌ Missing ID in index: ${id}`);
    ok = false;
  }
}
if (ok) console.log('✓ Bijection check passed');

// Check 3: TokenMap forward mapping
for (const note of index.notes) {
  if (note.tokens.length === 0) {
    console.log(`  Note ${note.id} has no tokens, skipping forward check`);
    continue;
  }
  for (const token of note.tokens) {
    if (!index.tokenMap[token]) {
      console.error(`❌ Token ${token} missing from tokenMap`);
      ok = false;
    } else if (!index.tokenMap[token].includes(note.id)) {
      console.error(`❌ Token ${token} does not include note ${note.id}`);
      ok = false;
    }
  }
}
if (ok) console.log('✓ TokenMap forward mapping passed');

// Check 4: TokenMap reverse mapping
for (const token of Object.keys(index.tokenMap)) {
  for (const id of index.tokenMap[token]) {
    const exists = index.notes.some(n => n.id === id);
    if (!exists) {
      console.error(`❌ Token ${token} references missing ID ${id}`);
      ok = false;
    }
  }
}
if (ok) console.log('✓ TokenMap reverse mapping passed');

console.log('\n=== End debug ===\n');
})();
