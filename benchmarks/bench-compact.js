const Store = require('../src/lib/store');
const { generateId } = require('../src/lib/utils');
const os = require('os');
const path = require('path');
const fs = require('fs');

function benchmarkAdds(compactMode, count = 1000) {
  const testDir = path.join(os.tmpdir(), 'quick-memo-compact-bench');
  const dataPath = path.join(testDir, 'notes.json');
  // Clean
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  const store = new Store(dataPath);
  // Set mode via env (must be set before store methods use it)
  process.env.QUICK_MEMO_COMPACT = compactMode ? '1' : '0';

  const start = process.hrtime.bigint();
  for (let i = 0; i < count; i++) {
    store.addNote({
      id: generateId(),
      content: `Benchmark note ${i} - some content to test storage performance`,
      tags: [],
      createdAt: Date.now()
    });
  }
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1e6;
  const fileSize = fs.statSync(dataPath).size;
  // Cleanup
  fs.rmSync(testDir, { recursive: true });
  return { duration, fileSize, count };
}

// First, do warm-up with compact to avoid cold start affecting both runs separately
benchmarkAdds(true, 100);

// Benchmark compact (default)
console.log('Running compact benchmark...');
const compactResult = benchmarkAdds(true, 1000);

// Benchmark pretty
console.log('Running pretty benchmark...');
const prettyResult = benchmarkAdds(false, 1000);

console.log('\n=== Results ===');
console.log(`Compact:  ${compactResult.count} adds in ${compactResult.duration.toFixed(2)} ms, file size ${compactResult.fileSize} bytes`);
console.log(`Pretty:   ${prettyResult.count} adds in ${prettyResult.duration.toFixed(2)} ms, file size ${prettyResult.fileSize} bytes`);
console.log(`Speedup:  ${(prettyResult.duration / compactResult.duration).toFixed(2)}x`);
console.log(`Size reduction: ${prettyResult.fileSize - compactResult.fileSize} bytes (${((prettyResult.fileSize - compactResult.fileSize)/prettyResult.fileSize*100).toFixed(1)}% smaller)`);
