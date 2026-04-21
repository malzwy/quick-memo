const Store = require('../lib/store');
const { loadConfig, getCommandConfig } = require('../lib/config');
const { success, error, info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerPurgeCommand(program) {
  program
    .command('purge <id>')
    .description('Permanently delete a single note from trash')
    .option('-f, --force', 'Skip confirmation prompt')
    .action((id, options) => {
      const store = new Store();
      // Load config for confirmation settings
      const config = loadConfig();
      const confirmConfig = getCommandConfig(config, 'purge', options);

      const trash = store.getTrashNotes();
      const index = trash.findIndex(n => n.id === id);
      if (index === -1) {
        error(`Note with ID ${id} not found in trash.`);
        process.exit(1);
      }
      const toDelete = trash[index];

      const skipConfirm = options.force || !confirmConfig.confirm;
      if (!skipConfirm) {
        console.log(`About to permanently delete: ${chalk.yellow(toDelete.content)}`);
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = chalk.red('Are you sure? This cannot be undone. (y/N): ');
        rl.question(question, (answer) => {
          rl.close();
          if (!answer || answer.toLowerCase() !== 'y') {
            info('Purge cancelled');
            return;
          }
            performPurge();
        });
      } else {
        performPurge();
      }

      function performPurge() {
        store.permanentlyDelete(id);
        success(`Purged note: ${toDelete.content}`);
      }
    });
};
