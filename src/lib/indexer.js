const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const os = require('os');

function getIndexPath() {
  if (process.env.QUICK_MEMO_INDEX_PATH) {
    return process.env.QUICK_MEMO_INDEX_PATH;
  }
  // Default: index.json in same directory as notes file
  const notesPath = process.env.QUICK_MEMO_PATH || path.join(require('os').homedir(), '.quick-memo', 'notes.json');
  return path.join(path.dirname(notesPath), 'index.json');
}

function getNotesStats(notesPath) {
  try {
    const stats = fs.statSync(notesPath);
    return {
      size: stats.size,
      mtime: stats.mtimeMs,
      exists: true
    };
  } catch (e) {
    return { exists: false, size: 0, mtime: 0 };
  }
}

function computeRev(notesPath) {
  const stats = getNotesStats(notesPath);
  if (!stats.exists) return null;
  // Use a combination of size and mtime to detect changes
  return `${stats.size}-${stats.mtime}`;
}

function needsRebuild(notesPath, index) {
  if (!index || !index.rev) return true;
  const currentRev = computeRev(notesPath);
  return currentRev !== index.rev;
}

const { tokenize } = require('./text-utils');

// Convert tokenMap with Set values to plain object with arrays for serialization
function tokenMapToArrays(tokenMap) {
  const result = Object.create(null);
  for (const [token, idSet] of Object.entries(tokenMap)) {
    result[token] = Array.from(idSet);
  }
  return result;
}

// Convert tokenMap from arrays (loaded from disk) to Sets for in-memory efficiency
function tokenMapToSets(tokenMapArrays) {
  const result = Object.create(null);
  for (const [token, ids] of Object.entries(tokenMapArrays)) {
    result[token] = new Set(ids);
  }
  return result;
}

function buildIndexSequential(notes, notesPath) {
  const rev = computeRev(notesPath);
  const noteEntries = [];
  const tokenMapBuilder = Object.create(null);
  for (const note of notes) {
    const tokens = tokenize(note.content);
    for (const token of tokens) {
      if (!tokenMapBuilder[token]) {
        tokenMapBuilder[token] = new Set();
      }
      tokenMapBuilder[token].add(note.id);
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
  const tokenMapSerial = tokenMapToArrays(tokenMapBuilder);
  return {
    version: 3,
    rev,
    lastUpdated: Date.now(),
    noteCount: notes.length,
    notes: noteEntries,
    tokenMap: tokenMapSerial
  };
}

// Parallel index build using worker threads
async function buildIndex(notes, notesPath) {
  const parallelThreshold = parseInt(process.env.QUICK_MEMO_PARALLEL_THRESHOLD, 10) || 1000;
  const cpuCount = os.cpus().length;
  const useParallel = notes.length >= parallelThreshold && cpuCount > 1;
  if (useParallel) {
    // Determine number of workers (min(cpuCount, ceil(notes/500)))
    const numWorkers = Math.min(cpuCount, Math.max(2, Math.ceil(notes.length / 500)));
    const chunkSize = Math.ceil(notes.length / numWorkers);
    const chunks = [];
    for (let i = 0; i < numWorkers; i++) {
      const start = i * chunkSize;
      if (start >= notes.length) break;
      const end = Math.min(start + chunkSize, notes.length);
      chunks.push(notes.slice(start, end));
    }
    // Spawn workers and compute partial indexes in parallel
    const workerPromises = chunks.map(chunk => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'indexer-worker.js'));
        worker.on('message', (result) => {
          resolve(result);
          worker.terminate();
        });
        worker.on('error', reject);
        worker.postMessage(chunk);
      });
    });
    const results = await Promise.all(workerPromises);
    // Merge partial results
    const noteEntries = [];
    const tokenMap = Object.create(null);
    for (const result of results) {
      const partNotes = result.noteEntries;
      const partTokenMap = result.tokenMap;
      if (partNotes) noteEntries.push(...partNotes);
      if (partTokenMap) {
        for (const [token, ids] of Object.entries(partTokenMap)) {
          if (!tokenMap[token]) tokenMap[token] = [];
          tokenMap[token].push(...ids);
        }
      }
    }
    return {
      version: 3,
      rev: computeRev(notesPath),
      lastUpdated: Date.now(),
      noteCount: noteEntries.length,
      notes: noteEntries,
      tokenMap
    };
  } else {
    // Fallback to sequential build for small datasets or uniprocess systems
    return buildIndexSequential(notes, notesPath);
  }
}

function loadIndex(indexPath) {
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(data);
    // Validate structure
    if (!index.version || !index.rev || !Array.isArray(index.notes)) {
      console.warn('Invalid index structure, ignoring.');
      return null;
    }
    // Convert tokenMap from arrays to Sets for efficient in-memory updates
    if (index.tokenMap) {
      index.tokenMap = tokenMapToSets(index.tokenMap);
    }
    return index;
  } catch (e) {
    console.warn(`Failed to load index: ${e.message}. Will rebuild.`);
    return null;
  }
}

function saveIndex(index, indexPath) {
  try {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    // Convert tokenMap Sets to arrays for compact JSON storage
    const indexToSave = { ...index };
    if (index.tokenMap && index.tokenMap instanceof Map) {
      // Not needed, we know it's plain object with Set values
    }
    if (index.tokenMap && typeof index.tokenMap === 'object' && !Array.isArray(index.tokenMap) && Object.values(index.tokenMap)[0] instanceof Set) {
      indexToSave.tokenMap = tokenMapToArrays(index.tokenMap);
    }
    fs.writeFileSync(indexPath, JSON.stringify(indexToSave, null, 0)); // compact JSON for space
    return true;
  } catch (e) {
    console.warn(`Failed to save index: ${e.message}`);
    return false;
  }
}

function getIndexedNotes(index) {
  if (!index || !index.notes) return null;
  // Return notes without the contentLower field? We still need original content.
  // Keep contentLower for search speed; we'll use the stored objects directly.
  return index.notes;
}

function isIndexFresh(index, notesPath) {
  if (!index || !index.rev) return false;
  const currentRev = computeRev(notesPath);
  return index.rev === currentRev;
}

function addOrUpdateNote(index, note) {
  const tokens = tokenize(note.content);
  const existingIdx = index.notes.findIndex(n => n.id === note.id);
  // Ensure tokenMap exists (should be Set-based)
  if (!index.tokenMap) {
    index.tokenMap = Object.create(null);
  }
  if (existingIdx !== -1) {
    // Remove old tokens from tokenMap before updating
    const oldNote = index.notes[existingIdx];
    if (oldNote.tokens && index.tokenMap) {
      for (const token of oldNote.tokens) {
        if (index.tokenMap[token]) {
          index.tokenMap[token].delete(note.id);
          if (index.tokenMap[token].size === 0) {
            delete index.tokenMap[token];
          }
        }
      }
    }
    // Update note entry
    const entry = {
      id: note.id,
      content: note.content,
      contentLower: note.content.toLowerCase(),
      tags: note.tags || [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || null,
      tokens
    };
    index.notes[existingIdx] = entry;
  } else {
    // Add new note
    const entry = {
      id: note.id,
      content: note.content,
      contentLower: note.content.toLowerCase(),
      tags: note.tags || [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || null,
      tokens
    };
    index.notes.push(entry);
  }
  // Add new tokens to tokenMap
  for (const token of tokens) {
    if (!index.tokenMap[token]) {
      index.tokenMap[token] = new Set();
    }
    index.tokenMap[token].add(note.id);
  }
  index.noteCount = index.notes.length;
}

function removeNote(index, noteId) {
  const noteIndex = index.notes.findIndex(n => n.id === noteId);
  if (noteIndex !== -1) {
    const note = index.notes[noteIndex];
    // Remove from tokenMap
    if (note.tokens && index.tokenMap) {
      for (const token of note.tokens) {
        if (index.tokenMap[token]) {
          index.tokenMap[token].delete(noteId);
          if (index.tokenMap[token].size === 0) {
            delete index.tokenMap[token];
          }
        }
      }
    }
    index.notes.splice(noteIndex, 1);
    index.noteCount = index.notes.length;
    return true;
  }
  return false;
}

module.exports = {
  getIndexPath,
  computeRev,
  needsRebuild,
  buildIndex,
  loadIndex,
  saveIndex,
  getIndexedNotes,
  isIndexFresh,
  addOrUpdateNote,
  removeNote,
  tokenize,
  tokenMapToSets,
  tokenMapToArrays
};
