const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function tokenize(text) {
  // Simple word tokenization: split on non-word characters, filter empty
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  // Return distinct tokens as array (no duplicates)
  return Array.from(new Set(words));
}

function buildIndex(notes, notesPath) {
  const rev = computeRev(notesPath);
  const noteEntries = [];
  const tokenMap = {};
  for (const note of notes) {
    const tokens = tokenize(note.content);
    // Populate tokenMap
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
  return {
    version: 3,
    rev,
    lastUpdated: Date.now(),
    noteCount: notes.length,
    notes: noteEntries,
    tokenMap
  };
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
    return index;
  } catch (e) {
    console.warn(`Failed to load index: ${e.message}. Will rebuild.`);
    return null;
  }
}

function saveIndex(index, indexPath) {
  try {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 0)); // compact JSON for space
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
  if (existingIdx !== -1) {
    // Remove old tokens from tokenMap before updating
    const oldNote = index.notes[existingIdx];
    if (oldNote.tokens && index.tokenMap) {
      for (const token of oldNote.tokens) {
        const ids = index.tokenMap[token];
        if (ids) {
          const idIndex = ids.indexOf(note.id);
          if (idIndex !== -1) {
            ids.splice(idIndex, 1);
            if (ids.length === 0) {
              delete index.tokenMap[token];
            }
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
  if (!index.tokenMap) index.tokenMap = {};
  for (const token of tokens) {
    if (!index.tokenMap[token]) {
      index.tokenMap[token] = [];
    }
    if (!index.tokenMap[token].includes(note.id)) {
      index.tokenMap[token].push(note.id);
    }
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
        const ids = index.tokenMap[token];
        if (ids) {
          const idIndex = ids.indexOf(noteId);
          if (idIndex !== -1) {
            ids.splice(idIndex, 1);
            if (ids.length === 0) {
              delete index.tokenMap[token];
            }
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
  removeNote
};
