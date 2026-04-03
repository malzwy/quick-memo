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
      console.error('Error reading notes, starting fresh');
      return [];
    }
  }

  saveNotes(notes) {
    fs.writeFileSync(this.dataPath, JSON.stringify(notes, null, 2));
  }

  addNote(note) {
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