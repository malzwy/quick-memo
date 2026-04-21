const Store = require('../lib/store');
const { loadConfig, getCommandConfig } = require('../lib/config');
const { error, info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerDeleteCommand(program) {
  program
    .command('delete <id>')
    .description('Delete a note by ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action((id, options) => {
      const store = new Store();
      // Load config for confirmation settings
      const config = loadConfig();
      const deleteConfig = getCommandConfig(config, 'delete', options);

      const notes = store.getNotes();
      const index = notes.findIndex(n => n.id === id);
      if (index === -1) {
        error(`Note with ID ${id} not found.`);
        process.exit(1);
      }
      const deleted = notes[index];

      // Determine if confirmation is needed
      const skipConfirm = options.force || !deleteConfig.confirm;
      if (!skipConfirm) {
        console.log(`About to delete: ${chalk.yellow(deleted.content)}`);
        console.log(`${chalk.gray('Tags:')} ${deleted.tags.join(', ') || 'none'}`);
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = chalk.red('Are you sure? (y/N): ');
        rl.question(question, (answer) => {
          rl.close();
          if (!answer || answer.toLowerCase() !== 'y') {
            info('Deletion cancelled');
            return;
          }
          performDelete();
        });
      } else {
        performDelete();
      }

      function performDelete() {
        const newNotes = notes.filter(n => n.id !== id);
        try {
          store.saveNotes(newNotes);
          success(`Deleted note: ${deleted.content}`);
        } catch (err) {
          error(`Failed to delete note: ${err.message}`);
          process.exit(1);
        }
      }
    });
};
