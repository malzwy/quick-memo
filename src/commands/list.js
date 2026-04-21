const Store = require('../lib/store');
const { loadConfig, getCommandConfig } = require('../lib/config');
const { info, formatNote } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerListCommand(program) {
  program
    .command('list [tag]')
    .description('List all notes, optionally filtered by tag')
    .option('-d, --detailed', 'Show full details including timestamps')
    .option('-j, --json', 'Output in JSON format')
    .option('-s, --sort <field>', 'Sort by: created (default), updated, or content', null)
    .option('--asc', 'Sort ascending (default is descending for date fields)')
    .action((tag, options) => {
      const store = new Store();
      // Load and merge config
      const config = loadConfig();
      const listConfig = getCommandConfig(config, 'list', options);

      let notes = store.getNotes();
      const filtered = tag ? notes.filter(n => n.tags.includes(tag)) : notes;

      // Sort notes using effective config
      filtered.sort((a, b) => {
        let valA, valB;
        switch (listConfig.sortBy) {
          case 'content':
            valA = a.content.toLowerCase();
            valB = b.content.toLowerCase();
            break;
          case 'updated':
            valA = a.updatedAt || a.createdAt;
            valB = b.updatedAt || b.createdAt;
            break;
          case 'created':
          default:
            valA = a.createdAt;
            valB = b.createdAt;
            break;
        }
        if (valA < valB) return listConfig.sortAsc ? -1 : 1;
        if (valA > valB) return listConfig.sortAsc ? 1 : -1;
        return 0;
      });

      if (listConfig.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      if (filtered.length === 0) {
        info('No notes found.');
        return;
      }

      filtered.forEach(note => {
        if (listConfig.detailed) {
          const date = new Date(note.createdAt).toLocaleString();
          const updated = note.updatedAt ? `\n  Updated: ${new Date(note.updatedAt).toLocaleString()}` : '';
          console.log(`[${chalk.cyan(note.id)}] ${note.content}`);
          console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
          console.log(`  ${chalk.gray('Created:')} ${date}${updated}`);
        } else {
          console.log(formatNote(note));
        }
      });

      info(`Total: ${filtered.length} note(s)`);
    });
};
