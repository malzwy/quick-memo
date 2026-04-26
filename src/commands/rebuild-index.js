const Store = require('../lib/store');
const indexer = require('../lib/indexer');
const { success, error, info } = require('../lib/helpers');

module.exports = function registerRebuildIndexCommand(program) {
  program
    .command('rebuild-index')
    .description('Rebuild the search index manually')
    .action(() => {
      try {
        const store = new Store();
        const notes = store.getNotes();
        const indexPath = indexer.getIndexPath();
        const index = indexer.buildIndex(notes, store.dataPath);
        if (indexer.saveIndex(index, indexPath)) {
          success(`Index rebuilt successfully with ${notes.length} note(s)`);
          info(`Index stored at: ${indexPath}`);
        } else {
          error('Failed to save index');
          process.exit(1);
        }
      } catch (err) {
        error(`Rebuild failed: ${err.message}`);
        process.exit(1);
      }
    });
};
