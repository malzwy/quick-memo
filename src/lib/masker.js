/**
 * Value Masking Utility for Quick Memo
 * Provides configurable masking for sensitive data in note content.
 *
 * Pattern Source: Based on EnvGuard masking patterns (AGENTS.md learnings)
 */

const defaultPatterns = [
  { regex: /sk_live_[\w]+/gi, description: 'Stripe live key' },
  { regex: /sk_test_[\w]+/gi, description: 'Stripe test key' },
  { regex: /ghp_[\w]+/gi, description: 'GitHub personal access token' },
  { regex: /sk-or-[\w]+/gi, description: 'OpenAI API key' },
  { regex: /Bearer [\w]+/gi, description: 'Bearer token' },
  { regex: /password\s*=\s*[\w]+/gi, description: 'Password assignment' },
  { regex: /secret\s*=\s*[\w]+/gi, description: 'Secret assignment' },
  { regex: /key\s*=\s*[\w]+/gi, description: 'Key assignment' },
  { regex: /token\s*=\s*[\w]+/gi, description: 'Token assignment' },
  { regex: /auth\s*=\s*[\w]+/gi, description: 'Auth assignment' }
];

/**
 * Masker class - handles detection and masking of sensitive content
 */
class Masker {
  constructor(config) {
    this.config = config || {};
    this.maskingConfig = this.config.masking || {};
    this.customPatterns = this.maskingConfig.customPatterns || [];
    this.regexCache = null; // Combined compiled regex, lazily built
  }

  /**
   * Build combined regex from default and custom patterns
   * @private
   */
  _buildCombinedRegex() {
    if (this.regexCache) return this.regexCache;

    const sources = [];

    // Add default patterns
    for (const p of defaultPatterns) {
      sources.push(`(${p.regex.source})`);
    }

    // Add custom patterns (strings or regex)
    for (const cp of this.customPatterns) {
      if (typeof cp === 'string') {
        try {
          // Allow regex literal syntax like '/pattern/flags'? Not needed; just plain string as regex
          // We'll compile as case-insensitive
          const r = new RegExp(cp, 'i');
          sources.push(`(${r.source})`);
        } catch (e) {
          // Skip invalid pattern
          continue;
        }
      } else if (cp instanceof RegExp) {
        sources.push(`(${cp.source})`);
      }
    }

    // Combine with global and case-insensitive (some patterns already have i; we'll add flags)
    // We want 'g' for replace, and 'i' for case-insensitivity.
    // But if pattern already has flags, combining might duplicate. Simpler: create new RegExp with all sources, 'gi'
    try {
      this.regexCache = new RegExp(sources.join('|'), 'gi');
    } catch (e) {
      // If fails, fallback to empty regex (no matches)
      this.regexCache = /(?:)/gi;
    }

    return this.regexCache;
  }

  /**
   * Mask a single token using configured parameters
   * @private
   */
  _maskToken(token, maskChar, showStart, showEnd) {
    const len = token.length;
    if (len === 0) return token;

    // If total visible length exceeds total length, mask entire string
    if (len <= showStart + showEnd) {
      return maskChar.repeat(len);
    }

    const start = token.substring(0, showStart);
    const end = token.substring(len - showEnd);
    const middle = maskChar.repeat(len - showStart - showEnd);

    return start + middle + end;
  }

  /**
   * Mask sensitive tokens within text content.
   * Replaces all matches of sensitive patterns with masked versions.
   * @param {string} text - The input text to mask
   * @param {object} options - Override options (maskChar, showStart, showEnd)
   * @returns {string} Masked text
   */
  maskText(text, options = {}) {
    if (!text || typeof text !== 'string') return text;

    const masking = this.maskingConfig;
    const maskChar = options.maskChar !== undefined ? options.maskChar : (masking.maskChar || '*');
    const showStart = options.showStart !== undefined ? options.showStart : (masking.showStart ?? 3);
    const showEnd = options.showEnd !== undefined ? options.showEnd : (masking.showEnd ?? 3);

    const combined = this._buildCombinedRegex();

    // If no patterns, return early
    if (!combined || combined.source === '(?:)') {
      return text;
    }

    // Use replace with callback to mask each match
    return text.replace(combined, (match) => {
      return this._maskToken(match, maskChar, showStart, showEnd);
    });
  }

  /**
   * Check if text contains any sensitive pattern (without masking)
   * @param {string} text
   * @returns {boolean}
   */
  containsSensitive(text) {
    if (!text || typeof text !== 'string') return false;
    const combined = this._buildCombinedRegex();
    return combined.test(text);
  }

  /**
   * Clear the compiled regex cache (useful after config changes)
   */
  clearCache() {
    this.regexCache = null;
  }

  /**
   * Reload configuration and custom patterns
   * @param {object} newConfig - Updated config object
   */
  reload(newConfig) {
    this.config = newConfig || this.config;
    this.maskingConfig = this.config.masking || {};
    this.customPatterns = this.maskingConfig.customPatterns || [];
    this.clearCache();
  }
}

// Helper: create a masker with current config
function createMasker(config) {
  return new Masker(config);
}

module.exports = {
  Masker,
  createMasker,
  defaultPatterns
};
