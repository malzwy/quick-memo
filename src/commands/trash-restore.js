const Store = require('../lib/store');
const { success, info } = require('../lib/helpers');
const chalk = require('chalk');
const IndexManager = require('../lib/indexManager');

module.exports = function registerTrashRestoreCommand(program) {
  program
    .command('trash-restore <id>')
    .description('Restore note from trash')
    .action((id) => {
      const store = new Store();
      const indexMgr = new IndexManager(store);
      indexMgr.load();
      const restored = store.restoreNote(id);
      try {
        indexMgr.afterAdd(restored);
      } catch (idxErr) {
        console.warn('Failed to update search index:', idxErr.message);
      }
      success(`Restored: ${restored.content}`);
      info(`Restored at: ${new Date(restored.createdAt).toLocaleString()`);
    });
};
