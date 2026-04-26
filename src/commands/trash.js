const Store = require('../lib/store');
const { success, info } = require('../lib/helpers');
const chalk = require('chalk');
const IndexManager = require('../lib/indexManager');

module.exports = function registerTrashCommand(program) {
  program
    .command('trash <id>')
    .description('Move note to trash (soft delete)')
    .action((id) => {
      const store = new Store();
      const indexMgr = new IndexManager(store);
      indexMgr.load();

      const trashed = store.trashNote(id);
      try {
        indexMgr.afterDelete(id);
      } catch (idxErr) {
        console.warn('Failed to update search index:', idxErr.message);
      }
      success(`Moved to trash: ${trashed.content}`);
      info(`Trashed at: ${new Date(trashed.trashedAt).toLocaleString()}`);
    });
};
