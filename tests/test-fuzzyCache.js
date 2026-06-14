const path = require('path');
const os = require('os');
const fs = require('fs');
const FuzzyCache = require('../src/lib/fuzzyCache');

// Use a dedicated test directory
const testDir = path.join(os.tmpdir(), 'quick-memo-fuzz-cache-test');
const cachePath = path.join(testDir, 'fuzzy-cache.json');

// Clean up
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

console.log('🧪 Fuzzy Cache Test Suite\n');

// Test 1: Cache miss and store
console.log('Test 1: Cache miss then store');
const cache1 = new FuzzyCache({ cacheDir: testDir, maxEntries: 10, ttlMs: 60000 });
const key1 = 'key1';
const result1 = { results: [{ id: '1', content: 'Note 1' }], scoredResults: [{ note: { id: '1' }, score: 0.9 }] };
if (cache1.get(key1)) {
  throw new Error('Expected cache miss');
}
console.log('  ✓ Cache initially empty');

cache1.set(key1, { results: result1.results, scoredResults: result1.scoredResults }, 'rev1');
const hit1 = cache1.get(key1);
if (!hit1) {
  throw new Error('Expected cache hit after set');
}
if (hit1.results.length !== 1 || hit1.results[0].id !== '1') {
  throw new Error('Cached results mismatched');
}
if (hit1.scoredResults[0].score !== 0.9) {
  throw new Error('Cached scoredResults mismatched');
}
console.log('  ✓ Set and get works');

// Test 2: Cache key generation
console.log('\nTest 2: Cache key consistency');
const cache2 = new FuzzyCache({ cacheDir: testDir });
const options1 = { fuzzy: true, fast: true, threshold: 0.3, tag: 'work,personal' };
const options2 = { fuzzy: true, fast: true, threshold: 0.3, tag: 'work,personal' }; // identical after normalization
const keyA = cache2.makeKey('query test', options1, 'rev123');
const keyB = cache2.makeKey('query test', options2, 'rev123');
if (keyA !== keyB) {
  throw new Error('Identical options should produce same key');
}
console.log('  ✓ Identical options produce same key');

const options3 = { fuzzy: true, fast: false, threshold: 0.5, tag: 'work' };
const keyC = cache2.makeKey('query test', options3, 'rev123');
if (keyA === keyC) {
  throw new Error('Different options should produce different key');
}
console.log('  ✓ Different options produce different key');

// Test 3: TTL expiration
console.log('\nTest 3: TTL expiration');
const cache3 = new FuzzyCache({ cacheDir: testDir, ttlMs: 10 }); // 10ms TTL
const key3 = 'expiring-key';
cache3.set(key3, { results: [{ id: '2' }], scoredResults: [{ note: {}, score: 0.8 }] }, 'rev2');
// Wait for expiry
const start = Date.now();
while (Date.now() - start < 15) {
  // busy wait minimal
}
const hit3 = cache3.get(key3);
if (hit3) {
  throw new Error('Entry should have expired');
}
console.log('  ✓ Expired entries are pruned');

// Test 4: LRU eviction
console.log('\nTest 4: LRU eviction (maxEntries)');
const cache4 = new FuzzyCache({ cacheDir: testDir, maxEntries: 3 });
for (let i = 0; i < 5; i++) {
  cache4.set(`key${i}`, { results: [{ id: String(i) }], scoredResults: [{ note: {}, score: i/10 }] }, `rev${i}`);
}
if (cache4.entries.size !== 3) {
  throw new Error(`Expected maxEntries=3, got ${cache4.entries.size}`);
}
// The first two keys should have been evicted
if (cache4.get('key0') || cache4.get('key1')) {
  throw new Error('Oldest entries should be evicted');
}
// Latest 3 should still exist
if (!cache4.get('key2') || !cache4.get('key3') || !cache4.get('key4')) {
  throw new Error('Recent entries should be retained');
}
console.log('  ✓ LRU eviction works');

// Test 5: Disk persistence
console.log('\nTest 5: Disk persistence');
const cache5 = new FuzzyCache({ cacheDir: testDir, maxEntries: 10, ttlMs: 60000 });
cache5.set('persist-key', { results: [{ id: 'p1' }], scoredResults: [{ note: {}, score: 1 }] }, 'rev-persist');
// Explicitly save
cache5.save();
// Create a new instance that loads from disk
const cache5b = new FuzzyCache({ cacheDir: testDir, maxEntries: 10, ttlMs: 60000 });
const hit5 = cache5b.get('persist-key');
if (!hit5 || hit5.results[0].id !== 'p1') {
  throw new Error('Cache should persist to disk');
}
console.log('  ✓ Disk persistence works');

// Test 6: Index revision handling
console.log('\nTest 6: Index revision in key');
const cache6 = new FuzzyCache({ cacheDir: testDir });
const keyRev1 = cache6.makeKey('query', { fuzzy: true, fast: false, threshold: 0.3, tag: '' }, 'rev1');
const keyRev2 = cache6.makeKey('query', { fuzzy: true, fast: false, threshold: 0.3, tag: '' }, 'rev2');
if (keyRev1 === keyRev2) {
  throw new Error('Different revisions should yield different keys');
}
console.log('  ✓ Revision changes produce new keys');

// Test 7: Clear function
console.log('\nTest 7: Clear cache');
const cache7 = new FuzzyCache({ cacheDir: testDir });
cache7.set('to-clear', { results: [{ id: 'x' }], scoredResults: [{ note: {}, score: 0.5 }] }, 'revx');
cache7.clear();
if (cache7.entries.size !== 0) {
  throw new Error('Cache should be empty after clear');
}
if (fs.existsSync(cachePath)) {
  // Clear should also remove disk file? Our clear implementation does not remove file, but we can optionally add that.
  // For now, just check in-memory is cleared; file will be overwritten on next save.
  // Acceptable.
}
console.log('  ✓ Clear empties in-memory cache');

// Test 8: Tag option normalization
console.log('\nTest 8: Tag normalization in key');
const cache8 = new FuzzyCache({ cacheDir: testDir });
const keyTag1 = cache8.makeKey('q', { fuzzy: true, fast: false, threshold: 0.3, tag: 'work, personal' }, 'rev');
const keyTag2 = cache8.makeKey('q', { fuzzy: true, fast: false, threshold: 0.3, tag: 'personal,work' }, 'rev');
// Should be same after splitting, trimming, sorting
if (keyTag1 !== keyTag2) {
  throw new Error('Tags should be normalized to sorted order');
}
console.log('  ✓ Tag order normalization works');

// Test 9: Debounced persistence - state management
console.log('\nTest 9: Debounce state');
const cache9 = new FuzzyCache({ cacheDir: testDir });
// Initially clean
let stats0 = cache9.stats();
if (stats0.dirty || stats0.timerActive) throw new Error('Initially dirty/timerActive should be false');
// After one set
cache9.set('a', { results: [], scoredResults: [] }, 'rev');
let stats1 = cache9.stats();
if (!stats1.dirty) throw new Error('dirty should be true after set');
if (!stats1.timerActive) throw new Error('timerActive should be true after set');
// After second set, dirty remains true, timerActive remains true (only one timer)
cache9.set('b', { results: [], scoredResults: [] }, 'rev');
let stats2 = cache9.stats();
if (!stats2.dirty) throw new Error('dirty should remain true');
if (!stats2.timerActive) throw new Error('timerActive should remain true');
// Manual flush clears dirty and timer
cache9.flush();
let stats3 = cache9.stats();
if (stats3.dirty) throw new Error('dirty should be false after flush');
if (stats3.timerActive) throw new Error('timerActive should be false after flush');
console.log('  ✓ Debounce state transitions correct');

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ All Fuzzy Cache tests passed!');
console.log('='.repeat(50));

// Cleanup on exit? We'll leave test artifacts; they are in /tmp.
