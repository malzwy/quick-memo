const fs = require('fs');
const path = require('path');

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
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadNotes() {
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

  saveNotes(notes) {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(notes, null, 2));
    } catch (e) {
      console.error(`Failed to save notes to ${this.dataPath}: ${e.message}`);
      throw e;
    }
  }

  addNote(note) {
    if (!note.content || !note.content.trim()) {
      throw new Error('Note content cannot be empty');
    }
    const notes = this.loadNotes();
    notes.push(note);
    this.saveNotes(notes);
    return note;
  }

  getNotes() {
    return this.loadNotes();
  }

  loadTrash() {
    if (!fs.existsSync(this.trashPath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(this.trashPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      // Backup corrupted trash file
      const backupPath = this.trashPath + '.corrupt-' + Date.now();
      try {
        if (fs.existsSync(this.trashPath)) {
          fs.copyFileSync(this.trashPath, backupPath);
          console.error(`Corrupted trash file backed up to: ${backupPath}`);
        }
      } catch (backupErr) {
        // Ignore backup errors
      }
      console.error('Error reading trash, starting fresh. Previous data backed up.');
      return [];
    }
  }

  saveTrash(trash) {
    try {
      fs.writeFileSync(this.trashPath, JSON.stringify(trash, null, 2));
    } catch (e) {
      console.error(`Failed to save trash to ${this.trashPath}: ${e.message}`);
      throw e;
    }
  }

  trashNote(id) {
    const notes = this.loadNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID ${id} not found.`);
    }
    const trashed = notes.splice(index, 1)[0];
    trashed.trashedAt = Date.now();
    const trash = this.loadTrash();
    trash.push(trashed);
    this.saveNotes(notes);
    this.saveTrash(trash);
    return trashed;
  }

  getTrashNotes() {
    return this.loadTrash();
  }

  restoreNote(id) {
    const trash = this.loadTrash();
    const index = trash.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID ${id} not found in trash.`);
    }
    const restored = trash.splice(index, 1)[0];
    delete restored.trashedAt;
    const notes = this.loadNotes();
    notes.push(restored);
    this.saveNotes(notes);
    this.saveTrash(trash);
    return restored;
  }

  permanentlyDelete(id) {
    // First try to delete from main notes (if not already trashed)
    const notes = this.loadNotes();
    const noteIndex = notes.findIndex(n => n.id === id);
    if (noteIndex !== -1) {
      notes.splice(noteIndex, 1);
      this.saveNotes(notes);
      return true;
    }
    // Then try to delete from trash
    const trash = this.loadTrash();
    const trashIndex = trash.findIndex(n => n.id === id);
    if (trashIndex !== -1) {
      trash.splice(trashIndex, 1);
      this.saveTrash(trash);
      return true;
    }
    throw new Error(`Note with ID ${id} not found.`);
  }

  emptyTrash() {
    try {
      if (fs.existsSync(this.trashPath)) {
        fs.unlinkSync(this.trashPath);
        return true;
      }
      return false;
    } catch (e) {
      console.error(`Failed to empty trash: ${e.message}`);
      throw e;
    }
  }

  // Remove a specific tag from a note
  // Returns true if tag was removed, false if tag not present
  // Throws if note not found
  untagNote(noteId, tag) {
    const notes = this.loadNotes();
    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
      throw new Error(`Note with ID ${noteId} not found.`);
    }
    const note = notes[noteIndex];
    const tagIndex = note.tags.indexOf(tag);
    if (tagIndex === -1) {
      return false; // tag not present
    }
    const newTags = [...note.tags];
    newTags.splice(tagIndex, 1);
    notes[noteIndex] = {
      ...note,
      tags: newTags,
      updatedAt: Date.now()
    };
    this.saveNotes(notes);
    return true;
  }
}

module.exports = Store;