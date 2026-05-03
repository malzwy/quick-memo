# Quick Memo Performance Benchmarks

This document captures performance baselines for Quick Memo. Benchmarks are part of the optimization process to detect regressions and validate improvements.

## Running Benchmarks

```bash
# Run all benchmarks (index rebuild, ops, search comparison)
npm run benchmark:all

# Individual benchmark suites
npm run benchmark         # Search performance comparison (with/without index)
npm run benchmark:index   # Index rebuild scalability
npm run benchmark:ops     # Mutating operations throughput (add/edit/delete)
```

Benchmark results are saved to `benchmarks/results/` with timestamps for historical tracking.

## Baseline Results (2026-04-29)

**Hardware/Environment:**
- Node.js v22.22.0
- Linux 6.8.0 (x64)
- tmpfs (in-memory filesystem)

### Index Rebuild (`benchmark:index`)

Measures time to rebuild the search index from notes array.

| Notes  | Time (ms) | Index Size | Throughput (notes/ms) |
|--------|-----------|------------|------------------------|
| 100    | 0.27      | 23.03 KB   | 371.95                 |
| 1,000  | 0.41      | 232.48 KB  | 2409.72                |
| 10,000 | 3.02      | 2.30 MB    | 3311.01                |
| 50,000 | 45.04     | 11.62 MB   | 1110.01                |
| 100,000| 83.63     | 23.27 MB   | 1195.78                |

**Observations:**
- Index rebuild is sub-linear; 10k → 100k is ~27x slower, not 100x (due to memory and algorithmic scaling)
- Peak throughput at 10k notes (3k notes/ms); larger datasets show memory pressure effects
- Full rebuild of 100k notes completes in <100ms, acceptable for manual `rebuild-index` command

### Mutating Operations (`benchmark:ops`)

Measures add/edit/delete throughput with index maintenance.

Operations tracked per second (note: each operation includes atomic file write + index update):

| Operation | Count | Time (ms) | Ops/ms  | Notes/sec (approx) |
|-----------|-------|-----------|---------|--------------------|
| add       | 1,000 | 2511      | 0.398   | ~400 adds/sec      |
| edit      | 500   | 2310      | 0.217   | ~220 edits/sec     |
| delete    | 500   | 1943      | 0.257   | ~260 deletes/sec   |

**Observations:**
- File I/O is the dominant cost (each operation writes to disk with locking)
- Index in-memory updates are negligible compared to I/O
- These numbers are for reliable, crash-safe operations with locks; caching or batching could improve but at safety cost

### Search Performance (`benchmark`)

Compares search with and without index (full file read each time). Dataset: 10k notes.

| Scenario              | Avg (ms) | Speedup vs Full Scan |
|-----------------------|----------|-----------------------|
| Full scan (file I/O)  | ~45-60   | 1x (baseline)        |
| Exact (in-memory idx) | ~0.2-0.5 | 100-200x             |
| Fuzzy (in-memory idx) | ~2-5     | 10-30x               |

**Insights:**
- The search index provides orders-of-magnitude improvement for exact search (eliminates file I/O and JSON parse)
- Fuzzy search is slower due to similarity scoring but still vastly faster than full scan with toLowerCase on each note
- Index size adds ~2-3x overhead (stores both content and contentLower), but remains modest (2.3MB for 10k notes)

## Performance Targets

- **Search**: 95th percentile < 5ms for exact, < 20ms for fuzzy with 10k notes
- **Add/Edit/Delete**: 500 ops/sec on typical SSD
- **Index rebuild**: < 100ms for up to 100k notes

## Regression Detection

Monitor benchmark results over time. If throughput drops >20% or latency increases >50% for any operation, investigate:

- Increased memory usage (GC pressure)
- Algorithmic changes (unnecessary iterations)
- File I/O patterns (unnecessary fsyncs, lock contention)
- Index size bloat

## Optimization Opportunities

- **Batching**: Multiple mutating operations could batch writes, but would reduce crash safety. Not recommended for CLI tool.
- **Index compression**: Store notes in a more compact format (e.g., Protocol Buffers) but adds complexity. JSON readability is valuable.
- **Incremental reindexing**: Already implemented for add/edit/delete. Full rebuild is only needed when index is missing or corrupted (as detected by file mtime/size checksum).

---

_Last updated: 2026-04-29 (Quick Memo v1.11.0)_
