const fc = require('fast-check');
const { generateId } = require('./src/lib/utils');

// Replicate noteArb from property.test.js
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

// Generate notes with unique IDs within a batch
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

// Generate a few examples
for (let i = 0; i < 5; i++) {
  fc.assert(fc.property(notesArb, (notes) => {
    console.log(`\nRun ${i}: Generated notes:`);
    console.log(JSON.stringify(notes, null, 2));
    // Check each note shape
    for (const n of notes) {
      if (!n || typeof n !== 'object') {
        throw new Error(`Invalid note: not an object (${typeof n})`);
      }
      if (!n.content) {
        throw new Error(`Invalid note: missing content (${JSON.stringify(n)})`);
      }
      if (!n.id) {
        throw new Error(`Invalid note: missing id (${JSON.stringify(n)})`);
      }
      if (!Array.isArray(n.tags)) {
        throw new Error(`Invalid note: tags not array (${JSON.stringify(n)})`);
      }
    }
  }));
}
