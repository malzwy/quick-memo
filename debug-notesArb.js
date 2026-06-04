const fc = require('fast-check');
const { generateId } = require('./src/lib/utils');

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

// Sample many times and check distribution
const samples = fc.sample(notesArb, { seed: 12345, size: 1000 });
let emptyCount = 0;
let minLen = Infinity, maxLen = 0;
for (const notes of samples) {
  if (!Array.isArray(notes)) {
    console.log('Non-array:', typeof notes);
  } else {
    if (notes.length === 0) emptyCount++;
    if (notes.length < minLen) minLen = notes.length;
    if (notes.length > maxLen) maxLen = notes.length;
    // Check first element shape
    if (notes.length > 0) {
      const n = notes[0];
      if (!n || typeof n !== 'object' || Array.isArray(n)) {
        console.log('First note invalid:', typeof n, n);
      }
    }
  }
}
console.log(`Total samples: ${samples.length}`);
console.log(`Empty arrays: ${emptyCount}`);
console.log(`Min length: ${minLen}, Max length: ${maxLen}`);

// Also print a few examples
console.log('\nFirst 5 samples:');
samples.slice(0, 5).forEach((notes, i) => {
  console.log(`Sample ${i}: length=${notes?.length}, first:`, notes[0] ? { id: notes[0].id, content: notes[0].content?.substring(0, 20) } : null);
});
