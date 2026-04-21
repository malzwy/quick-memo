const Store = require('../lib/store');
const { success } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTrashCommand(program) {
  program
    .command('trash <id>')
    .description('Move note to trash (soft delete)')
    .action((id) => {
      const store = new Store();
      const trashed = store.trashNote(id);
      success(`Moved to trash: ${trashed.content}`);
      info(`Trashed at: ${new Date(trashed.trashedAt).toLocaleString()}`);
    });
};
