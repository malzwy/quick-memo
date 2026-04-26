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

function buildIndex(notes, notesPath) {
  const rev = computeRev(notesPath);
  return {
    version: 1,
    rev,
    lastUpdated: Date.now(),
    noteCount: notes.length,
    notes: notes.map(note => ({
      id: note.id,
      content: note.content,
      contentLower: note.content.toLowerCase(),
      tags: note.tags || [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt || null
    }))
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
  const entry = {
    id: note.id,
    content: note.content,
    contentLower: note.content.toLowerCase(),
    tags: note.tags || [],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt || null
  };
  const existingIdx = index.notes.findIndex(n => n.id === note.id);
  if (existingIdx !== -1) {
    index.notes[existingIdx] = entry;
  } else {
    index.notes.push(entry);
  }
}

function removeNote(index, noteId) {
  const initialLength = index.notes.length;
  index.notes = index.notes.filter(n => n.id !== noteId);
  return index.notes.length < initialLength;
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
