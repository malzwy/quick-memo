const Store = require('../lib/store');
const { loadConfig, getCommandConfig } = require('../lib/config');
const { success, info } = require('../lib/helpers');
const chalk = require('chalk');
const IndexManager = require('../lib/indexManager');

module.exports = function registerTrashEmptyCommand(program) {
  program
    .command('trash-empty')
    .description('Permanently delete all trashed notes')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
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
        rl.question(question, async (answer) => {
          rl.close();
          if (!answer || answer.toLowerCase() !== 'y') {
            info('Empty trash cancelled');
            return;
          }
          await performEmptyTrash();
        });
      } else {
        performEmptyTrash();
      }

      async function performEmptyTrash() {
        store.emptyTrash();
        // Reconcile index efficiently: if stale, attempt incremental sync (which may rebuild if needed)
        try {
          const indexMgr = new IndexManager(store);
          indexMgr.load();
          await indexMgr.maybeReconcile();
        } catch (idxErr) {
          console.warn('Failed to reconcile search index after emptying trash:', idxErr.message);
        }
        success(`Emptyed trash: ${trash.length} note(s) permanently deleted`);
      }
    });
};
