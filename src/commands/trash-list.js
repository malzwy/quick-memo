const Store = require('../lib/store');
const { info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTrashListCommand(program) {
  program
    .command('trash-list')
    .description('List all trashed notes')
    .option('-d, --detailed', 'Show full details including timestamps')
    .option('-j, --json', 'Output in JSON format')
    .option('--unmasked', 'Show sensitive values without masking')
    .action((options) => {
      const store = new Store();
      const trash = store.getTrashNotes();

      // Load config for masking
      const { loadConfig } = require('../lib/config');
      const config = loadConfig();
      const maskingEnabled = (config.masking && config.masking.autoMask) !== false;
      const shouldMask = maskingEnabled && !options.unmasked;
      let masker = null;
      if (shouldMask) {
        const { Masker } = require('../lib/masker');
        masker = new Masker(config);
      }

      if (options.json) {
        let outputTrash = trash;
        if (shouldMask) {
          outputTrash = trash.map(note => ({
            ...note,
            content: masker.maskText(note.content)
          }));
        }
        console.log(JSON.stringify(outputTrash, null, 2));
        return;
      }

      if (trash.length === 0) {
        info('Trash is empty');
        return;
      }

      if (options.detailed) {
        trash.forEach(note => {
          const date = new Date(note.trashedAt).toLocaleString();
          const content = shouldMask ? masker.maskText(note.content) : note.content;
          console.log(`[${chalk.cyan(note.id)}] ${content}`);
          console.log(`  ${chalk.gray('Trashed:')} ${date}`);
          if (note.tags && note.tags.length > 0) {
            console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
          }
          console.log();
        });
      } else {
        trash.forEach(note => {
          const date = new Date(note.trashedAt).toLocaleString();
          const content = shouldMask ? masker.maskText(note.content) : note.content;
          console.log(`[${chalk.cyan(note.id)}] ${content} ${chalk.gray(`(${date})`)}`);
        });
      }

      info(`Total: ${trash.length} note(s) in trash`);
    });
};
