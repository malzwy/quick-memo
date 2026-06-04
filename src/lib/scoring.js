/**
 * Fast fuzzy scoring algorithms for token-based similarity.
 */

const { tokenize } = require('./text-utils');

/**
 * Compute a relevance score for a note given a query.
 * Uses hybrid metric: primary = query token coverage, secondary = note compactness.
 * @param {Set<string>} queryTokens - Tokenized query set
 * @param {string[]} noteTokens - Array of tokens from the note
 * @returns {number} Score in range [0, 1]
 */
function computeScore(queryTokens, noteTokens) {
  const qTokenCount = queryTokens.size;
  if (qTokenCount === 0) {
    return 0;
  }

  const noteTokenCount = noteTokens.length;
  let intersection = 0;
  for (const token of noteTokens) {
    if (queryTokens.has(token)) {
      intersection++;
    }
  }

  // Primary: fraction of query tokens present in note (coverage)
  const coverage = intersection / qTokenCount;

  // Secondary: compactness – shorter notes are preferred (penalize length)
  // Decay factor: 0.2 per token; 1/(1+0.2*len) yields values between ~0.5 (len=5) and 0.25 (len=10)
  const compactness = 1 / (1 + noteTokenCount * 0.2);

  // Lexicographic scoring: coverage dominates; compactness breaks ties.
  // Scale compactness by EPS so that any coverage difference outweighs any compactness difference.
  // This ensures full coverage always ranks above partial, and among equal coverage, shorter notes rank higher.
  const EPS = 0.0001;
  const score = coverage + compactness * EPS;
  return score;
}

module.exports = { computeScore };
