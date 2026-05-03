const indexer = require('./indexer');
const path = require('path');

class IndexManager {
  constructor(store) {
    this.store = store;
    this.indexPath = indexer.getIndexPath();
    this.index = null;
    this.fresh = false;
  }

  /**
   * Load the index and determine if it's fresh (up-to-date with notes file).
   * @returns {Object|null} The index object or null if none exists
   */
  load() {
    this.index = indexer.loadIndex(this.indexPath);
    this.fresh = this.index && indexer.isIndexFresh(this.index, this.store.dataPath) && this.index.version >= 3;
    return this.index;
  }

  /**
   * Check if the index is fresh (up-to-date).
   * @returns {boolean}
   */
  isFresh() {
    return this.fresh;
  }

  /**
   * Get the current index (must call load() first).
   * @returns {Object|null}
   */
  getIndex() {
    return this.index;
  }

  /**
   * Update the index after adding a new note.
   * If the index was fresh, performs an incremental update;
   * otherwise, rebuilds the entire index from scratch.
   * @param {Object} note - The note that was added
   */
  afterAdd(note) {
    if (this.fresh) {
      indexer.addOrUpdateNote(this.index, note);
      this.index.noteCount = this.index.notes.length;
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      this.rebuild();
    }
  }

  /**
   * Update the index after editing an existing note.
   * If the index was fresh, performs an incremental update;
   * otherwise, rebuilds the entire index.
   * @param {Object} note - The updated note
   */
  afterEdit(note) {
    if (this.fresh) {
      indexer.addOrUpdateNote(this.index, note);
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      this.rebuild();
    }
  }

  /**
   * Update the index after deleting a note.
   * If the index was fresh, removes the note from index incrementally;
   * otherwise, rebuilds the entire index.
   * @param {string} noteId - The ID of the deleted note
   */
  afterDelete(noteId) {
    if (this.fresh) {
      indexer.removeNote(this.index, noteId);
      this.index.noteCount = this.index.notes.length;
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      this.rebuild();
    }
  }

  /**
   * Rebuild the entire index from all current notes.
   * This is guaranteed to produce a consistent index.
   */
  rebuild() {
    const notes = this.store.getNotes();
    this.index = indexer.buildIndex(notes, this.store.dataPath);
    indexer.saveIndex(this.index, this.indexPath);
  }
}

module.exports = IndexManager;
