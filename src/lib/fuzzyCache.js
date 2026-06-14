const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * FuzzyCache - Persistent LRU cache for fuzzy search results.
 *
 * Caches search results to avoid recomputation for repeated queries.
 * Cache invalidation is automatic via index revision (included in key).
 * Cache is stored on disk in ~/.quick-memo/fuzzy-cache.json with restricted permissions.
 *
 * Features:
 * - LRU eviction (most recent entries kept)
 * - TTL-based expiration (configurable)
 * - Automatic pruning of stale entries on load
 * - Secure file permissions (0600)
 */

class FuzzyCache {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 100;
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes default
    this.cacheDir = options.cacheDir || path.join(os.homedir(), '.quick-memo');
    this.cachePath = path.join(this.cacheDir, 'fuzzy-cache.json');
    this.entries = new Map(); // key -> { results, indexRev, timestamp }
    this.dirty = false;
    this.saveTimer = null;
    this.load();
    // Ensure we flush on graceful shutdown
    this._setupSignalHandlers();
  }

  /**
   * Generate a deterministic cache key from search parameters.
   * Includes query, options, and index revision to ensure correctness.
   */
  makeKey(query, options, indexRev) {
    // Normalize threshold to 3 decimal places for consistency
    const threshold = options.threshold ? parseFloat(options.threshold).toFixed(3) : '0.300';
    // Normalize tags array (sorted, comma-separated)
    const tags = (options.tag || '').split(',').map(t => t.trim()).filter(t => t).sort().join(',');
    // Include all relevant options
    const keyStr = `${query}|f=${options.fuzzy}|fast=${options.fast}|t=${threshold}|tags=${tags}|rev=${indexRev}`;
    // Use SHA-256 for compact, uniform key
    return crypto.createHash('sha256').update(keyStr).digest('hex');
  }

  /**
   * Load cache from disk, pruning stale entries.
   */
  load() {
    try {
      if (!fs.existsSync(this.cachePath)) return;
      const data = fs.readFileSync(this.cachePath, 'utf8');
      const raw = JSON.parse(data);
      const now = Date.now();
      const entries = raw.entries || [];

      // Rebuild Map, pruning stale and expired
      for (const entry of entries) {
        // Check TTL
        if (now - entry.timestamp > this.ttlMs) continue;
        // Keep entry
        this.entries.set(entry.key, entry);
      }

      // Enforce maxEntries by removing oldest (LRU: assume array order is insertion order)
      if (this.entries.size > this.maxEntries) {
        const excess = this.entries.size - this.maxEntries;
        const keysToRemove = Array.from(this.entries.keys()).slice(0, excess);
        for (const key of keysToRemove) {
          this.entries.delete(key);
        }
      }
    } catch (e) {
      // On any corruption, start fresh but log warning
      console.warn(`FuzzyCache: failed to load (${e.message}), starting with empty cache`);
      this.entries.clear();
    }
  }

  /**
   * Save cache to disk atomically with secure permissions.
   * This is the low-level write; callers should typically use flush()
   * to respect debouncing semantics.
   */
  save() {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      // Convert Map to array for serialization
      const entriesArray = Array.from(this.entries.values());

      // Prune stale entries one more time (TTL may have expired during session)
      const now = Date.now();
      const fresh = entriesArray.filter(e => now - e.timestamp <= this.ttlMs);

      const data = JSON.stringify({ entries: fresh }, null, 0); // compact
      const tmpPath = this.cachePath + '.tmp-' + process.pid;
      fs.writeFileSync(tmpPath, data, 'utf8');
      // Set secure permissions: read/write for owner only
      fs.chmodSync(tmpPath, 0o600);
      fs.renameSync(tmpPath, this.cachePath);
      fs.chmodSync(this.cachePath, 0o600);
    } catch (e) {
      console.warn(`FuzzyCache: failed to save (${e.message})`);
      throw e; // rethrow to let flush know
    }
  }

  /**
   * Get cached results for a key, if present and not expired (double-check TTL).
   * Returns { results, timestamp } or null.
   */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    // Check TTL again (in-memory might have expired)
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  /**
   * Set a cache entry. Prunes to maxEntries if needed.
   * Persistence is debounced to reduce disk I/O during rapid successive calls.
   */
  set(key, payload, indexRev) {
    // payload should contain { results, scoredResults }
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    const entry = {
      key,
      ...payload,
      indexRev,
      timestamp: Date.now()
    };
    this.entries.set(key, entry);

    // If exceeding max, remove oldest (first in insertion order)
    if (this.entries.size > this.maxEntries) {
      const keys = Array.from(this.entries.keys());
      this.entries.delete(keys[0]);
    }

    // Mark dirty and schedule debounced flush
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveTimer = setTimeout(() => {
      this.flush();
    }, 500); // 500ms debounce
  }

  /**
   * Force immediate save if there are pending changes.
   * Used for graceful shutdown and explicit synchronization.
   */
  flush() {
    if (!this.dirty) return;
    try {
      this.save();
      this.dirty = false;
    } catch (e) {
      console.warn(`FuzzyCache: failed to flush (${e.message})`);
      // Keep dirty = true so we'll retry later
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Clear entire cache and persist immediately.
   */
  clear() {
    this.entries.clear();
    this.flush(); // persist empty state
  }

  /**
   * Get current cache statistics (for debugging/info).
   */
  stats() {
    return {
      entries: this.entries.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      cachePath: this.cachePath,
      dirty: this.dirty,
      timerActive: !!this.saveTimer
    };
  }

  /**
   * Register process signal handlers to ensure cache is flushed on exit.
   * @private
   */
  _setupSignalHandlers() {
    const flush = () => this.flush();
    process.on('SIGINT', flush);
    process.on('SIGTERM', flush);
    // Also flush on 'exit' event? Not needed; flush will be called via signals, but for abnormal exits we can't guarantee.
  }
}

module.exports = FuzzyCache;
