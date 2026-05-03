const fs = require('fs');

/**
 * Efficient sleep using Atomics.wait (non-CPU-busy) with busy-wait fallback.
 * @param {number} ms - Milliseconds to sleep
 */
function sleepSync(ms) {
  try {
    // Use Atomics.wait on a SharedArrayBuffer for efficient blocking sleep
    const buffer = new SharedArrayBuffer(4);
    const int32 = new Int32Array(buffer);
    Atomics.wait(int32, 0, 0, ms);
  } catch (e) {
    // Fallback to busy-wait if Atomics unavailable
    const start = Date.now();
    while (Date.now() - start < ms) {}
  }
}

/**
 * FileLock - Simple cross-platform file locking using lock files.
 *
 * Provides exclusive lock creation with automatic stale lock cleanup.
 * Suitable for CLI tools to prevent concurrent write collisions.
 *
 * Features:
 * - Exponential backoff with jitter to reduce thundering herd
 * - Overall timeout to avoid indefinite blocking
 * - Efficient sleep (Atomics.wait) to reduce CPU usage
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
   * @param {number} options.retries - Maximum number of acquisition attempts (default: 3)
   * @param {number} options.retryDelay - Base delay between attempts in ms (default: 100)
   * @param {number} options.timeoutMs - Overall timeout in ms (default: retries * retryDelay, or 30000)
   * @param {number} options.maxDelay - Maximum backoff delay in ms (default: 200)
   */
  constructor(lockPath, options = {}) {
    this.lockPath = lockPath;
    this.retries = options.retries !== undefined ? options.retries : 3;
    this.retryDelay = options.retryDelay || 100;
    // Overall timeout: if provided explicitly use that, else derive from retries
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : (this.retries * this.retryDelay);
    this.maxDelay = options.maxDelay || 200;
    this.locked = false;
  }

  /**
   * Acquire the lock, blocking until successful or timeout/retries exhausted.
   * Throws Error if lock cannot be acquired.
   */
  acquire() {
    const start = Date.now();
    let attempts = 0;
    while (true) {
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
        // Check overall timeout
        const elapsed = Date.now() - start;
        if (elapsed >= this.timeoutMs) {
          throw new Error(`Failed to acquire lock after ${elapsed}ms (timeout): ${this.lockPath}`);
        }
        // Enforce explicit retry limit for backward compatibility
        if (attempts >= this.retries) {
          throw new Error(`Failed to acquire lock after ${this.retries} attempts: ${this.lockPath}`);
        }
        // Compute exponential backoff with jitter
        let delay = this.retryDelay * Math.pow(2, attempts);
        delay = Math.min(this.maxDelay, delay);
        // Add jitter: up to 50% of delay
        const jitter = Math.random() * delay * 0.5;
        delay += jitter;
        sleepSync(delay);
        attempts++;
      }
    }
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
