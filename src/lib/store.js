const fs = require('fs');
const path = require('path');
const FileLock = require('./lock');

class Store {
  constructor(customPath) {
    if (customPath) {
      this.dataPath = customPath;
    } else if (process.env.QUICK_MEMO_PATH) {
      this.dataPath = process.env.QUICK_MEMO_PATH;
    } else {
      this.dataPath = path.join(require('os').homedir(), '.quick-memo', 'notes.json');
    }
    this.trashPath = this.dataPath.replace(/\.json$/, '.trash.json');
    this.lockPath = this.dataPath + '.lock';
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // --- Private file I/O with atomic writes ---

  _loadNotes() {
    if (!fs.existsSync(this.dataPath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      // Backup corrupted file for recovery
      const backupPath = this.dataPath + '.corrupt-' + Date.now();
      try {
        if (fs.existsSync(this.dataPath)) {
          fs.copyFileSync(this.dataPath, backupPath);
          console.error(`Corrupted notes file backed up to: ${backupPath}`);
        }
      } catch (backupErr) {
        // Ignore backup errors
      }
      console.error('Error reading notes, starting fresh. Previous data backed up.');
      return [];
    }
  }

  _saveNotes(notes) {
    try {
      // Atomic write: write to temp file then rename
      const compact = process.env.QUICK_MEMO_COMPACT === '1';
      const content = JSON.stringify(notes, null, compact ? null : 2);
      const tmpPath = this.dataPath + '.tmp-' + Date.now() + '.' + process.pid;
      fs.writeFileSync(tmpPath, content, 'utf8');
      fs.renameSync(tmpPath, this.dataPath);
    } catch (e) {
      console.error(`Failed to save notes to ${this.dataPath}: ${e.message}`);
      throw e;
    }
  }

  _loadTrash() {
    if (!fs.existsSync(this.trashPath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(this.trashPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      const backupPath = this.trashPath + '.corrupt-' + Date.now();
      try {
        if (fs.existsSync(this.trashPath)) {
          fs.copyFileSync(this.trashPath, backupPath);
          console.error(`Corrupted trash file backed up to: ${backupPath}`);
        }
      } catch (backupErr) {
        // Ignore
      }
      console.error('Error reading trash, starting fresh. Previous data backed up.');
      return [];
    }
  }

  _saveTrash(trash) {
    try {
      const compact = process.env.QUICK_MEMO_COMPACT === '1';
      const content = JSON.stringify(trash, null, compact ? null : 2);
      const tmpPath = this.trashPath + '.tmp-' + Date.now() + '.' + process.pid;
      fs.writeFileSync(tmpPath, content, 'utf8');
      fs.renameSync(tmpPath, this.trashPath);
    } catch (e) {
      console.error(`Failed to save trash to ${this.trashPath}: ${e.message}`);
      throw e;
    }
  }

  // Backward compatibility: direct save without explicit lock (still atomic)
  saveNotes(notes) {
    this._saveNotes(notes);
  }

  // Backward compatibility: direct trash save
  saveTrash(trash) {
    this._saveTrash(trash);
  }

  // --- Locking abstraction ---

  _runLocked(fn) {
    // Allow lock timeout configuration via environment variable
    const lockTimeoutEnv = process.env.QUICK_MEMO_LOCK_TIMEOUT;
    const lockOptions = {};
    if (lockTimeoutEnv) {
      const timeoutMs = parseInt(lockTimeoutEnv, 10);
      if (!isNaN(timeoutMs) && timeoutMs > 0) {
        lockOptions.timeoutMs = timeoutMs;
      }
    }
    const lock = new FileLock(this.lockPath, lockOptions);
    lock.acquire();
    try {
      return fn();
    } finally {
      lock.release();
    }
  }

  // --- Public read API ---

  getNotes() {
    return this._loadNotes();
  }

  getTrashNotes() {
    return this._loadTrash();
  }

  // --- Public mutating API (all atomic with locking) ---

  addNote(note) {
    return this._runLocked(() => {
      if (!note.content || !note.content.trim()) {
        throw new Error('Note content cannot be empty');
      }
      const notes = this._loadNotes();
      notes.push(note);
      this._saveNotes(notes);
      return note;
    });
  }

  addNotes(notesArray) {
    return this._runLocked(() => {
      if (!Array.isArray(notesArray)) {
        throw new Error('addNotes expects an array');
      }
      const existing = this._loadNotes();
      const added = [];
      for (const note of notesArray) {
        if (!note.content || !note.content.trim()) {
          continue; // skip empty notes
        }
        added.push(note);
      }
      const newNotes = existing.concat(added);
      this._saveNotes(newNotes);
      return added;
    });
  }

  deleteNote(id) {
    return this._runLocked(() => {
      const notes = this._loadNotes();
      const index = notes.findIndex(n => n.id === id);
      if (index === -1) {
        throw new Error(`Note with ID ${id} not found.`);
      }
      const deleted = notes.splice(index, 1)[0];
      this._saveNotes(notes);
      return deleted;
    });
  }

  editNote(id, newContent, newTags) {
    return this._runLocked(() => {
      const trimmed = newContent.trim();
      if (!trimmed) {
        throw new Error('Note content cannot be empty');
      }
      const notes = this._loadNotes();
      const noteIndex = notes.findIndex(n => n.id === id);
      if (noteIndex === -1) {
        throw new Error(`Note with ID ${id} not found.`);
      }
      const updated = {
        ...notes[noteIndex],
        content: trimmed,
        tags: newTags || notes[noteIndex].tags,
        updatedAt: Date.now()
      };
      notes[noteIndex] = updated;
      this._saveNotes(notes);
      return updated;
    });
  }

  untagNote(noteId, tag) {
    return this._runLocked(() => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) {
        throw new Error('Tag cannot be empty');
      }
      const notes = this._loadNotes();
      const noteIndex = notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) {
        throw new Error(`Note with ID ${noteId} not found.`);
      }
      const note = notes[noteIndex];
      const tagIndex = note.tags.indexOf(trimmedTag);
      if (tagIndex === -1) {
        return false;
      }
      const newTags = [...note.tags];
      newTags.splice(tagIndex, 1);
      notes[noteIndex] = {
        ...note,
        tags: newTags,
        updatedAt: Date.now()
      };
      this._saveNotes(notes);
      return notes[noteIndex];
    });
  }

  trashNote(id) {
    return this._runLocked(() => {
      const notes = this._loadNotes();
      const index = notes.findIndex(n => n.id === id);
      if (index === -1) {
        throw new Error(`Note with ID ${id} not found.`);
      }
      const trashed = notes.splice(index, 1)[0];
      trashed.trashedAt = Date.now();
      const trash = this._loadTrash();
      trash.push(trashed);
      this._saveNotes(notes);
      this._saveTrash(trash);
      return trashed;
    });
  }

  restoreNote(id) {
    return this._runLocked(() => {
      const trash = this._loadTrash();
      const index = trash.findIndex(n => n.id === id);
      if (index === -1) {
        throw new Error(`Note with ID ${id} not found in trash.`);
      }
      const restored = trash.splice(index, 1)[0];
      delete restored.trashedAt;
      const notes = this._loadNotes();
      notes.push(restored);
      this._saveNotes(notes);
      this._saveTrash(trash);
      return restored;
    });
  }

  permanentlyDelete(id) {
    return this._runLocked(() => {
      // Try main notes first
      let notes = this._loadNotes();
      const noteIndex = notes.findIndex(n => n.id === id);
      if (noteIndex !== -1) {
        notes.splice(noteIndex, 1);
        this._saveNotes(notes);
        return true;
      }
      // Then trash
      let trash = this._loadTrash();
      const trashIndex = trash.findIndex(n => n.id === id);
      if (trashIndex !== -1) {
        trash.splice(trashIndex, 1);
        this._saveTrash(trash);
        return true;
      }
      throw new Error(`Note with ID ${id} not found.`);
    });
  }

  emptyTrash() {
    return this._runLocked(() => {
      if (fs.existsSync(this.trashPath)) {
        fs.unlinkSync(this.trashPath);
        return true;
      }
      return false;
    });
  }

  /**
   * Replace all notes (used by restore command).
   * Operates atomically with lock.
   * @param {Array} notes - Complete notes array
   */
  replaceAll(notes) {
    return this._runLocked(() => {
      if (!Array.isArray(notes)) {
        throw new Error('replaceAll expects an array');
      }
      this._saveNotes(notes);
    });
  }
}

module.exports = Store;
