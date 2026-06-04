/**
 * Text processing utilities shared across Quick Memo modules.
 */

/**
 * Tokenize text into unique lowercase words.
 * Splits on non-word characters and removes duplicates.
 *
 * @param {string} text - Input text
 * @returns {string[]} Array of unique tokens
 */
function tokenize(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return Array.from(new Set(words));
}

/**
 * Compute query token coverage score: what fraction of query tokens appear in the note.
 * This is the primary relevance signal for fast token-based search.
 *
 * @param {Set<string>} queryTokens - Tokenized query
 * @param {string[]} noteTokens - Note's tokens
 * @returns {number} Score 0-1 (1.0 = all query tokens present)
 */
function computeCoverage(queryTokens, noteTokens) {
  if (queryTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of noteTokens) {
    if (queryTokens.has(token)) intersection++;
  }
  return intersection / queryTokens.size;
}

/**
 * Compute note compactness score: inverse of note token count normalized.
 * Shorter notes (with same coverage) are considered more relevant.
 *
 * @param {number} noteTokenCount - Number of tokens in the note
 * @returns {number} Score 0-1 (approaches 1 for very short notes)
 */
function computeCompactness(noteTokenCount) {
  // Use a diminishing curve: notes with 1-5 tokens get high scores, long notes get low
  // Formula: 1 / (1 + noteTokenCount * 0.2) gives reasonable decay
  return 1 / (1 + noteTokenCount * 0.2);
}

module.exports = {
  tokenize,
  computeCoverage,
  computeCompactness
};
