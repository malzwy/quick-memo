const fs = require('fs');
const path = require('path');

class Store {
  constructor(customPath) {
    if (customPath) {
      this.dataPath = customPath;
    } else {
      this.dataPath = path.join(require('os').homedir(), '.quick-memo', 'notes.json');
    }
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
}

module.exports = Store;