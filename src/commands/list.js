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
    .option('--limit <number>', 'Maximum number of results to display')
    .option('--offset <number>', 'Number of results to skip (default: 0)')
    .option('--compact', 'Output plain format without colors (ideal for piping)')
    .option('--unmasked', 'Show sensitive values without masking')

    .action((tag, options) => {
      const store = new Store();
      // Load and merge config
      const config = loadConfig();
      const listConfig = getCommandConfig(config, 'list', options);

      // Determine masking settings (proactive security)
      const maskingEnabled = (config.masking && config.masking.autoMask) !== false;
      const unmasked = options.unmasked;
      const shouldMask = maskingEnabled && !unmasked;
      let masker = null;
      if (shouldMask) {
        const { Masker } = require('../lib/masker');
        masker = new Masker(config);
      }

      // Map CLI options to internal config keys (--sort -> sortBy, --asc -> sortAsc)
      const effectiveSortBy = options.sort !== undefined ? options.sort : listConfig.sortBy;
      const effectiveSortAsc = options.asc !== undefined ? options.asc : listConfig.sortAsc;

      // Parse pagination options
      let offset = 0;
      let limit = null;
      if (options.offset !== undefined) {
        const parsed = parseInt(options.offset, 10);
        if (isNaN(parsed) || parsed < 0) {
          console.error(chalk.red('✗ Offset must be a non-negative integer'));
          process.exit(1);
        }
        offset = parsed;
      }
      if (options.limit !== undefined) {
        const parsed = parseInt(options.limit, 10);
        if (isNaN(parsed) || parsed <= 0) {
          console.error(chalk.red('✗ Limit must be a positive integer'));
          process.exit(1);
        }
        limit = parsed;
      }

      let notes = store.getNotes();
      const filtered = tag ? notes.filter(n => n.tags.includes(tag)) : notes;

      // Sort notes using effective config
      filtered.sort((a, b) => {
        let valA, valB;
        switch (effectiveSortBy) {
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
        if (valA < valB) return effectiveSortAsc ? -1 : 1;
        if (valA > valB) return effectiveSortAsc ? 1 : -1;
        return 0;
      });

      // Apply pagination
      const totalCount = filtered.length;
      let displayNotes = filtered;
      if (offset > 0 || limit !== null) {
        const start = offset;
        const end = limit !== null ? offset + limit : undefined;
        displayNotes = filtered.slice(start, end);
      }

      if (listConfig.json) {
        let outputNotes = displayNotes;
        if (shouldMask) {
          outputNotes = displayNotes.map(note => ({
            ...note,
            content: masker.maskText(note.content)
          }));
        }
        console.log(JSON.stringify(outputNotes, null, 2));
        return;
      }

      if (displayNotes.length === 0) {
        if (totalCount === 0) {
          info('No notes found.');
        } else {
          info(`No results to display (offset ${offset} beyond total ${totalCount} results).`);
        }
        return;
      }

      const isCompact = options.compact || (config.list && config.list.compact);

      displayNotes.forEach(note => {
        if (listConfig.detailed) {
          const date = new Date(note.createdAt).toLocaleString();
          const updated = note.updatedAt ? `\n  Updated: ${new Date(note.updatedAt).toLocaleString()}` : '';
          const content = shouldMask ? masker.maskText(note.content) : note.content;
          console.log(`[${chalk.cyan(note.id)}] ${content}`);
          console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
          console.log(`  ${chalk.gray('Created:')} ${date}${updated}`);
        } else if (isCompact) {
          // Compact: plain ID, content, tags without colors
          const content = shouldMask ? masker.maskText(note.content) : note.content;
          const tagStr = note.tags.join(',');
          console.log(`${note.id} ${content} #${tagStr}`);
        } else {
          console.log(formatNote(note, false, shouldMask ? masker : null, unmasked));
        }
      });

      if (isCompact) {
        // Compact mode: show minimal summary
        console.log(`# total:${totalCount} shown:${displayNotes.length}${offset > 0 ? ` offset:${offset}` : ''}`);
      } else {
        let msg = `Total: ${totalCount} note(s)`;
        if (offset > 0 || limit !== null) {
          const shownStart = offset + 1;
          const shownEnd = offset + displayNotes.length;
          msg += ` [showing ${shownStart}-${shownEnd} of ${totalCount}]`;
        }
        info(msg);
      }
    });
};
