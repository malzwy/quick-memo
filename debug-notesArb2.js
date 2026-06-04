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

// Before the mapping with generateUniqueId, check the raw array
const rawArrayArb = fc.array(noteArb, { min: 1, max: 100 });

const samplesRaw = fc.sample(rawArrayArb, { seed: 12345, size: 100 });
let emptyCount = 0;
for (const arr of samplesRaw) {
  if (arr.length === 0) emptyCount++;
}
console.log(`Raw array samples: ${samplesRaw.length}, empty count: ${emptyCount}`);

// Now test the full notesArb
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

const samplesFull = fc.sample(notesArb, { seed: 12345, size: 100 });
emptyCount = 0;
for (const arr of samplesFull) {
  if (arr.length === 0) emptyCount++;
}
console.log(`Full notesArb samples: ${samplesFull.length}, empty count: ${emptyCount}`);

// Additionally, test if the inner map can produce empty arrays
console.log('\nTesting map behavior:');
const testInput = [{ id: '1', content: 'a', tags: [], createdAt: 1, updatedAt: 1 }];
const testOutput = testInput.map(n => ({ ...n, id: generateUniqueId() }));
console.log('Input length:', testInput.length);
console.log('Output length:', testOutput.length);
console.log('Output first:', testOutput[0]);
