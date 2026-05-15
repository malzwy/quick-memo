/**
 * Indexer Worker
 * Worker thread script for parallel index building.
 * Receives a chunk of notes and returns partial index data.
 */

const { parentPort } = require('worker_threads');

// Import tokenize only (we don't need full indexer to avoid circular)
function tokenize(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return Array.from(new Set(words));
}

parentPort.on('message', (notes) => {
  const noteEntries = [];
  const tokenMap = Object.create(null);

  for (const note of notes) {
    const tokens = tokenize(note.content);
    // Populate tokenMap for this chunk
    for (const token of tokens) {
      if (!tokenMap[token]) {
        tokenMap[token] = [];
      }
      tokenMap[token].push(note.id);
    }
    noteEntries.push({
      id: note.id,
      content: note.content,
      contentLower: note.content.toLowerCase(),
      tags: note.tags || [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || null,
      tokens
    });
  }

  // Send result back
  parentPort.postMessage({ noteEntries, tokenMap });
});