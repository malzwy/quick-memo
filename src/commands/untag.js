const Store = require('../lib/store');
const { success, error } = require('../lib/helpers');
const IndexManager = require('../lib/indexManager');

module.exports = function registerUntagCommand(program) {
  program
    .command('untag <id> <tag>')
    .description('Remove a specific tag from a note')
    .action((id, tag) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) {
        error('Tag cannot be empty');
        process.exit(1);
      }
      const store = new Store();
      const indexMgr = new IndexManager(store);
      indexMgr.load();

      try {
        const result = store.untagNote(id, trimmedTag);
        if (result === false) {
          error(`Tag '${trimmedTag}' not found on note ${id}.`);
          process.exit(1);
        }
        const updatedNote = result;
        try {
          indexMgr.afterEdit(updatedNote);
        } catch (idxErr) {
          console.warn('Failed to update search index:', idxErr.message);
        }
        success(`Removed tag '${trimmedTag}' from note ${id}`);
      } catch (err) {
        error(`Failed to untag: ${err.message}`);
        process.exit(1);
      }
    });
};
