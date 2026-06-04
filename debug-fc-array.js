const fc = require('fast-check');

const noteArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { max: 5 }),
  createdAt: fc.integer({ min: 0, max: Date.now() }),
  updatedAt: fc.integer({ min: 0, max: Date.now() })
});

console.log('Testing fc.array with min:1');

// Generate 1000 samples directly via fc.sample
const arrayArb = fc.array(noteArb, { min: 1, max: 100 });
const samples = fc.sample(arrayArb, { size: 1000 });

let emptyCount = 0;
let totalLength = 0;
let minLen = Infinity, maxLen = 0;
for (const arr of samples) {
  if (!Array.isArray(arr)) {
    console.log('Not array:', typeof arr);
    continue;
  }
  if (arr.length === 0) emptyCount++;
  if (arr.length < minLen) minLen = arr.length;
  if (arr.length > maxLen) maxLen = arr.length;
  totalLength += arr.length;
}
console.log(`Total samples: ${samples.length}`);
console.log(`Empty arrays: ${emptyCount}`);
console.log(`Average length: ${totalLength / samples.length}`);
console.log(`Min length: ${minLen}, Max length: ${maxLen}`);

// Maybe the issue is that fc.sample by default may shrink during sampling? Let's also try generate
console.log('\nGenerating via fc.sample with fewer iterations:');
const smallSamples = fc.sample(arrayArb, { size: 20, seed: 42 });
smallSamples.forEach((arr, i) => {
  console.log(`Sample ${i}: length=${arr.length}`);
});
