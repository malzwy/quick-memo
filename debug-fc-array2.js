const fc = require('fast-check');

const noteArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { max: 5 }),
  createdAt: fc.integer({ min: 0, max: Date.now() }),
  updatedAt: fc.integer({ min: 0, max: Date.now() })
});

const arrayArb = fc.array(noteArb, { min: 1, max: 100 });

// Use fc.random to generate 100 values directly
const rng = fc.random;
let emptyCount = 0;
let minLen = Infinity, maxLen = 0;
for (let i = 0; i < 100; i++) {
  const val = arrayArb.generate(rng);
  if (!Array.isArray(val)) {
    console.log('Not array');
    continue;
  }
  if (val.length === 0) emptyCount++;
  if (val.length < minLen) minLen = val.length;
  if (val.length > maxLen) maxLen = val.length;
}
console.log(`Random 100 generations: empty=${emptyCount}, min=${minLen}, max=${maxLen}`);

// Use fc.sample
const samples = fc.sample(arrayArb, { size: 100 });
emptyCount = 0;
minLen = Infinity; maxLen = 0;
for (const val of samples) {
  if (val.length === 0) emptyCount++;
  if (val.length < minLen) minLen = val.length;
  if (val.length > maxLen) maxLen = val.length;
}
console.log(`fc.sample 100: empty=${emptyCount}, min=${minLen}, max=${maxLen}`);

// Try fc.many times with a single run
const { arb } = arrayArb;
const single = arb;
// The 'arb' property returns an instance of Arbitrary with its own generate method
const singleVal = single.generate(rng);
console.log('Single generate via arb:', Array.isArray(singleVal), singleVal.length);
