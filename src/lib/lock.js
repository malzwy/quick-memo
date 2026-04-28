const fs = require('fs');
const path = require('path');

/**
 * FileLock - Simple cross-platform file locking using lock files.
 *
 * Provides exclusive lock creation with automatic stale lock cleanup.
 * Suitable for CLI tools to prevent concurrent write collisions.
 *
 * Usage:
 *   const lock = new FileLock('/path/to/file.lock');
 *   lock.acquire();
 *   try {
 *     // perform critical section
 *   } finally {
 *     lock.release();
 *   }
 */
class FileLock {
  /**
   * @param {string} lockPath - Full path to the lock file
   * @param {Object} options - Configuration options
   * @param {number} options.retries - Number of acquisition attempts (default: 3)
   * @param {number} options.retryDelay - Delay between attempts in ms (default: 100)
   */
  constructor(lockPath, options = {}) {
    this.lockPath = lockPath;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 100;
    this.locked = false;
  }

  /**
   * Acquire the lock, blocking until successful or retries exhausted.
   * Throws Error if lock cannot be acquired.
   */
  acquire() {
    let attempts = 0;
    while (attempts < this.retries) {
      try {
        // O_EXCL with open fails if file exists
        const fd = fs.openSync(this.lockPath, 'wx');
        // Write our PID for debugging/stale detection
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
        this.locked = true;
        return;
      } catch (err) {
        if (err.code !== 'EEXIST') {
          // Unexpected error
          throw err;
        }
        // Lock file exists - check if stale
        try {
          const content = fs.readFileSync(this.lockPath, 'utf8');
          const lockPid = parseInt(content, 10);
          if (!isNaN(lockPid) && lockPid !== process.pid) {
            try {
              // process.kill(pid, 0) checks existence without signaling
              process.kill(lockPid, 0);
              // Process still alive, lock is held
            } catch (e) {
              if (e.code === 'ESRCH') {
                // Stale lock (process no longer exists)
                fs.unlinkSync(this.lockPath);
                continue; // retry immediately
              }
            }
          }
        } catch (e) {
          // ignore read errors; will retry or fail
        }
        // Wait before next retry (simple busy-wait)
        if (attempts < this.retries - 1) {
          const start = Date.now();
          while (Date.now() - start < this.retryDelay) {
            // busy wait; acceptable for short durations
          }
        }
        attempts++;
      }
    }
    throw new Error(`Failed to acquire lock after ${this.retries} attempts: ${this.lockPath}`);
  }

  /**
   * Release the lock if held.
   */
  release() {
    if (this.locked && fs.existsSync(this.lockPath)) {
      try {
        fs.unlinkSync(this.lockPath);
      } catch (e) {
        // Ignore errors during release
      }
    }
    this.locked = false;
  }

  /**
   * Run a function under lock protection.
   * @param {Function} fn - Function to execute while lock is held
   * @returns {*} Return value of fn
   */
  run(fn) {
    this.acquire();
    try {
      return fn();
    } finally {
      this.release();
    }
  }
}

module.exports = FileLock;
