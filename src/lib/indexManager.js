const indexer = require('./indexer');
const { tokenize } = require('./text-utils');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora').default;
const config = require('./config');

class IndexManager {
  constructor(store) {
    this.store = store;
    this.indexPath = indexer.getIndexPath();
    this.index = null;
    this.fresh = false;
    this.noteMap = null;
  }

  /**
   * Load the index and determine if it's fresh (up-to-date with notes file).
   * @returns {Object|null} The index object or null if none exists
   */
  load() {
    this.index = indexer.loadIndex(this.indexPath);
    // Convert tokenMap from arrays (serialized) to Sets for efficient in-memory updates
    if (this.index && this.index.version >= 3 && this.index.tokenMap && Object.values(this.index.tokenMap)[0] instanceof Array) {
      this.index.tokenMap = indexer.tokenMapToSets(this.index.tokenMap);
    }
    // Build noteMap for fast lookups if index exists
    if (this.index) {
      this.noteMap = new Map(this.index.notes.map(n => [n.id, n]));
    } else {
      this.noteMap = null;
    }
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
   * Get the note lookup map (id -> note). Builds lazily if not available.
   * @returns {Map}
   */
  getNoteMap() {
    if (!this.noteMap && this.index) {
      this.noteMap = new Map(this.index.notes.map(n => [n.id, n]));
    }
    return this.noteMap;
  }

  /**
   * Update the index after adding a new note.
   * If the index was fresh, performs an incremental update;
   * otherwise, tries incremental sync or full rebuild.
   * @param {Object} note - The note that was added
   */
  async afterAdd(note) {
    if (this.fresh) {
      indexer.addOrUpdateNote(this.index, note);
      // Update noteMap with the new/updated entry
      const entry = {
        id: note.id,
        content: note.content,
        contentLower: note.content.toLowerCase(),
        tags: note.tags || [],
        createdAt: note.createdAt,
        updatedAt: note.updatedAt || null,
        tokens: tokenize(note.content)
      };
      this.noteMap.set(note.id, entry);
      this.index.noteCount = this.index.notes.length;
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      await this.maybeReconcile();
    }
  }

  /**
   * Update the index after editing an existing note.
   * If the index was fresh, performs an incremental update;
   * otherwise, tries incremental sync or full rebuild.
   * @param {Object} note - The updated note
   */
  async afterEdit(note) {
    if (this.fresh) {
      indexer.addOrUpdateNote(this.index, note);
      // Update noteMap with the edited entry
      const entry = {
        id: note.id,
        content: note.content,
        contentLower: note.content.toLowerCase(),
        tags: note.tags || [],
        createdAt: note.createdAt,
        updatedAt: note.updatedAt || null,
        tokens: tokenize(note.content)
      };
      this.noteMap.set(note.id, entry);
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      await this.maybeReconcile();
    }
  }

  /**
   * Update the index after deleting a note.
   * If the index was fresh, removes the note from index incrementally;
   * otherwise, tries incremental sync or full rebuild.
   * @param {string} noteId - The ID of the deleted note
   */
  async afterDelete(noteId) {
    if (this.fresh) {
      indexer.removeNote(this.index, noteId);
      this.noteMap.delete(noteId);
      this.index.noteCount = this.index.notes.length;
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
    } else {
      await this.maybeReconcile();
    }
  }

  /**
   * Rebuild the entire index from all current notes.
   * This is guaranteed to produce a consistent index.
   */
  async rebuild() {
    const notes = this.store.getNotes();
    this.index = await indexer.buildIndex(notes, this.store.dataPath);
    // Convert tokenMap from arrays (serializable form) to Sets for efficient in-memory updates
    this.index.tokenMap = indexer.tokenMapToSets(this.index.tokenMap);
    // Build noteMap for fast lookups
    this.noteMap = new Map(this.index.notes.map(n => [n.id, n]));
    indexer.saveIndex(this.index, this.indexPath);
    // Mark index as fresh after successful rebuild so subsequent operations use incremental updates
    this.fresh = true;
  }

  /**
   * Attempt to incrementally synchronize the index with the current notes
   * without a full rebuild. This is faster when only a small fraction of
   * notes have changed since the last index build.
   * @private
   * @returns {boolean} true if incremental sync was applied, false if fallback to full rebuild is recommended
   */
  syncIncremental() {
    if (!this.index) {
      return false;
    }

    const notes = this.store.getNotes();
    const currentIds = new Set(notes.map(n => n.id));
    const indexIds = new Set(this.index.notes.map(n => n.id));

    // Determine changes
    const added = notes.filter(n => !indexIds.has(n.id));
    const deleted = this.index.notes.filter(n => !currentIds.has(n.id));
    // Updated: note exists in both and has newer updatedAt than index build time
    const indexNotesById = new Map(this.index.notes.map(n => [n.id, n]));
    const updated = notes.filter(n => {
      const idxEntry = indexNotesById.get(n.id);
      return idxEntry && n.updatedAt > (this.index.lastUpdated || 0);
    });

    const totalChanges = added.length + deleted.length + updated.length;

    // Threshold: if changes exceed X% of index size or at least 200 notes, fallback to full rebuild.
    // Configurable via config.sync.thresholdPercent (percentage) or config.sync.thresholdAbsolute (absolute).
    const config = require('./config');
    const syncConfig = config.getConfigKey('sync') || {};
    const thresholdPercent = syncConfig.thresholdPercent != null ? syncConfig.thresholdPercent : 5;
    const thresholdAbsolute = syncConfig.thresholdAbsolute != null ? syncConfig.thresholdAbsolute : 0;

    let threshold;
    if (thresholdAbsolute > 0) {
      threshold = thresholdAbsolute;
    } else {
      // Use percent-based threshold with a floor of 200 changes
      threshold = Math.max(200, Math.floor(this.index.noteCount * (thresholdPercent / 100)));
    }

    if (totalChanges > threshold) {
      return false;
    }

    // Apply changes
    for (const note of added) {
      indexer.addOrUpdateNote(this.index, note);
    }
    for (const note of updated) {
      indexer.addOrUpdateNote(this.index, note);
    }
    for (const note of deleted) {
      indexer.removeNote(this.index, note.id);
    }

    if (totalChanges > 0) {
      this.index.noteCount = this.index.notes.length;
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
      this.fresh = true;
    } else {
      // No content changes detected, but index was stale (likely due to external mtime change).
      // Mark as fresh and update rev to current to avoid repeated false staleness.
      this.index.rev = indexer.computeRev(this.store.dataPath);
      this.index.lastUpdated = Date.now();
      indexer.saveIndex(this.index, this.indexPath);
      this.fresh = true;
    }

    // Refresh noteMap to reflect current index state
    this.noteMap = new Map(this.index.notes.map(n => [n.id, n]));

    return true;
  }

  /**
   * Ensure the index is up-to-date. If it's stale, attempt incremental sync,
   * otherwise perform full rebuild.
   */
  async maybeReconcile() {
    if (this.fresh) return;
    if (!this.syncIncremental()) {
      await this.rebuild();
    }
  }

  /**
   * Ensure the index is ready for use: load and reconcile if stale or outdated.
   * Provides user-friendly progress messages during upgrade/rebuild.
   * @param {boolean} showMessage - Whether to print status messages (default true)
   * @returns {Promise<Object|null>} The fresh index
   */
  async ensureReady(showMessage = true) {
    this.load();
    if (this.fresh) {
      return this.index;
    }

    // Determine reason
    const isMissing = !this.index;
    const isUpgrade = this.index && this.index.version < 3;

    let message;
    if (isMissing) {
      message = 'Building initial search index';
    } else if (isUpgrade) {
      message = `Upgrading search index (from v${this.index.version})`;
    } else {
      message = 'Refreshing search index';
    }

    let spinner;
    if (showMessage) {
      spinner = ora({
        text: message,
        spinner: 'dots'
      }).start();
    }

    try {
      await this.maybeReconcile();
      if (spinner) {
        spinner.succeed(isMissing ? 'Index built' : isUpgrade ? 'Index upgraded' : 'Index refreshed');
      }
    } catch (err) {
      if (spinner) {
        spinner.fail('Index operation failed');
      }
      throw err;
    }

    return this.index;
  }
}

module.exports = IndexManager;
