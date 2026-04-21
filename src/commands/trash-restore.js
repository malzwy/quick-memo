const Store = require('../lib/store');
const { success } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTrashRestoreCommand(program) {
  program
    .command('trash-restore <id>')
    .description('Restore note from trash')
    .action((id) => {
      const store = new Store();
      const restored = store.restoreNote(id);
      success(`Restored: ${restored.content}`);
      info(`Restored at: ${new Date(restored.createdAt).toLocaleString()}`);
    });
};
