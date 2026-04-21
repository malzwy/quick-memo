const Store = require('../lib/store');
const { info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTrashListCommand(program) {
  program
    .command('trash-list')
    .description('List all trashed notes')
    .option('-d, --detailed', 'Show full details including timestamps')
    .option('-j, --json', 'Output in JSON format')
    .action((options) => {
      const store = new Store();
      const trash = store.getTrashNotes();

      if (options.json) {
        console.log(JSON.stringify(trash, null, 2));
        return;
      }

      if (trash.length === 0) {
        info('Trash is empty');
        return;
      }

      if (options.detailed) {
        trash.forEach(note => {
          const date = new Date(note.trashedAt).toLocaleString();
          console.log(`[${chalk.cyan(note.id)}] ${note.content}`);
          console.log(`  ${chalk.gray('Trashed:')} ${date}`);
          if (note.tags && note.tags.length > 0) {
            console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
          }
          console.log();
        });
      } else {
        trash.forEach(note => {
          const date = new Date(note.trashedAt).toLocaleString();
          console.log(`[${chalk.cyan(note.id)}] ${note.content} ${chalk.gray(`(${date})`)}`);
        });
      }

      info(`Total: ${trash.length} note(s) in trash`);
    });
};
