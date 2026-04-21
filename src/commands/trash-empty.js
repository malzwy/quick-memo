const Store = require('../lib/store');
const { loadConfig, getCommandConfig } = require('../lib/config');
const { success, info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTrashEmptyCommand(program) {
  program
    .command('trash-empty')
    .description('Permanently delete all trashed notes')
    .option('-f, --force', 'Skip confirmation prompt')
    .action((options) => {
      const store = new Store();
      // Load config for confirmation settings
      const config = loadConfig();
      const confirmConfig = getCommandConfig(config, 'trash-empty', options);

      const trash = store.getTrashNotes();

      if (trash.length === 0) {
        info('Trash is already empty');
        return;
      }

      const skipConfirm = options.force || !confirmConfig.confirm;
      if (!skipConfirm) {
        console.log(`About to permanently delete ${trash.length} note(s) from trash:`);
        console.log();
        trash.forEach(note => {
          console.log(`- ${note.content}`);
        });
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = chalk.red('Are you sure? This cannot be undone. (y/N): ');
        rl.question(question, (answer) => {
          rl.close();
          if (!answer || answer.toLowerCase() !== 'y') {
            info('Empty trash cancelled');
            return;
          }
          performEmptyTrash();
        });
      } else {
        performEmptyTrash();
      }

      function performEmptyTrash() {
        store.emptyTrash();
        success(`Emptyed trash: ${trash.length} note(s) permanently deleted`);
      }
    });
};
