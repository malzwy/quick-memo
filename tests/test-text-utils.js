#!/usr/bin/env node

/**
 * Text Utils Unit Tests
 * Tests for tokenize, computeCoverage, computeCompactness
 */

const { tokenize, computeCoverage, computeCompactness } = require('../src/lib/text-utils');

console.log('🧪 Text Utils Test Suite\n');

// Test 1: Tokenize basic
console.log('Test 1: Tokenize basic');
const result1 = tokenize('Hello world! This is a test.');
if (!Array.isArray(result1) || !result1.includes('hello') || !result1.includes('world')) {
  throw new Error('Tokenize failed to extract words');
}
console.log('  ✓ Basic tokenization OK');

// Test 2: Tokenize removes duplicates
console.log('\nTest 2: Tokenize deduplication');
const result2 = tokenize('test test TEST test');
if (result2.length !== 1 || !result2.includes('test')) {
  throw new Error('Tokenize should produce unique tokens');
}
console.log('  ✓ Deduplication OK');

// Test 3: Tokenize handles punctuation and numbers
console.log('\nTest 3: Tokenize with numbers/punctuation');
const result3 = tokenize('Node.js v14.0.0, awesome!');
if (!result3.includes('node') || !result3.includes('js') || !result3.includes('v14') || !result3.includes('0') || !result3.includes('awesome')) {
  throw new Error('Tokenize should split on non-word and include numeric tokens');
}
console.log('  ✓ Numbers and punctuation OK');

// Test 4: Tokenize empty string
console.log('\nTest 4: Tokenize empty');
const result4 = tokenize('');
if (!Array.isArray(result4) || result4.length !== 0) {
  throw new Error('Tokenize empty string should return empty array');
}
console.log('  ✓ Empty returns [] OK');

// Test 5: Compute coverage
console.log('\nTest 5: Compute coverage');
const queryTokens = new Set(['meeting', 'team', 'project']);
const noteTokens1 = ['meeting', 'team', 'deadline'];
const cov1 = computeCoverage(queryTokens, noteTokens1); // 2/3 = 0.666...
if (Math.abs(cov1 - 2/3) > 0.001) {
  throw new Error(`Coverage expected ~0.667, got ${cov1}`);
}
console.log('  ✓ Coverage calculation OK');

// Test 6: Coverage with no intersection
console.log('\nTest 6: Coverage zero');
const noteTokens2 = ['lunch', 'personal'];
const cov2 = computeCoverage(queryTokens, noteTokens2);
if (cov2 !== 0) {
  throw new Error(`Coverage should be 0 for no overlap, got ${cov2}`);
}
console.log('  ✓ Zero coverage OK');

// Test 7: Coverage with full match
console.log('\nTest 7: Coverage full');
const noteTokens3 = ['meeting', 'team', 'project'];
const cov3 = computeCoverage(queryTokens, noteTokens3);
if (cov3 !== 1.0) {
  throw new Error(`Coverage should be 1.0 for full match, got ${cov3}`);
}
console.log('  ✓ Full coverage OK');

// Test 8: Compute compactness
console.log('\nTest 8: Compactness scores');
const comp1 = computeCompactness(1); // 1/(1+0.2)=0.833...
const comp5 = computeCompactness(5); // 1/(1+1)=0.5
const comp10 = computeCompactness(10); // 1/(1+2)=0.333...
if (comp1 <= comp5 || comp5 <= comp10) {
  throw new Error('Compactness should decrease with token count');
}
if (Math.abs(comp1 - (1/1.2)) > 0.001) throw new Error('Compactness miscalc');
console.log('  ✓ Compactness decay OK');

// Test 9: Edge cases
console.log('\nTest 9: Edge cases');
const covEmptyQuery = computeCoverage(new Set(), ['test']);
if (covEmptyQuery !== 0) throw new Error('Empty query should yield 0 coverage');
const compZero = computeCompactness(0);
if (compZero !== 1) throw new Error('Zero token note should have max compactness');
console.log('  ✓ Edge cases OK');

console.log('\n✅ All Text Utils tests passed!\n');
