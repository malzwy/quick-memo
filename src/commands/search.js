const Store = require('../lib/store');
const stringSimilarity = require('string-similarity');
const { info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerSearchCommand(program) {
  program
    .command('search <query>')
    .description('Search notes by content')
    .option('-j, --json', 'Output in JSON format')
    .option('-t, --tag <tag>', 'Filter by tag (comma-separated for multiple tags)')
    .option('-f, --fuzzy', 'Enable fuzzy matching for approximate matches')
    .option('--threshold <number>', 'Similarity threshold for fuzzy search (0-1, default: 0.3)', '0.3')
    .action((query, options) => {
      const trimmed = query.trim();
      if (!trimmed) {
        console.error(chalk.red('✗ Search query cannot be empty'));
        process.exit(1);
      }
      const store = new Store();
      const notes = store.getNotes();
      let results = [];
      let threshold = null;

      if (options.fuzzy) {
        // Fuzzy search: find notes with similar content
        threshold = parseFloat(options.threshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 1) {
          console.error(chalk.red('✗ Threshold must be a number between 0 and 1'));
          process.exit(1);
        }
        // Calculate similarity scores for all notes
        const scored = notes.map(note => {
          const similarity = stringSimilarity.compareTwoStrings(trimmed.toLowerCase(), note.content.toLowerCase());
          return { note, score: similarity };
        });
        // Filter by threshold and sort by score descending
        results = scored
          .filter(item => item.score >= threshold)
          .sort((a, b) => b.score - a.score)
          .map(item => item.note);
      } else {
        // Exact search (original behavior)
        results = notes.filter(n =>
          n.content.toLowerCase().includes(trimmed.toLowerCase())
        );
      }

      // Apply tag filter if provided
      if (options.tag) {
        const tagFilters = options.tag.split(',').map(t => t.trim()).filter(t => t);
        if (tagFilters.length > 0) {
          results = results.filter(n => tagFilters.some(tag => n.tags.includes(tag)));
        }
      }

      if (results.length === 0) {
        if (options.json) {
          console.log('[]');
        } else {
          info('No matching notes found.');
        }
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (options.fuzzy) {
        // Show scores for fuzzy results to indicate relevance
        const scored = results.map(note => ({
          note,
          score: stringSimilarity.compareTwoStrings(trimmed.toLowerCase(), note.content.toLowerCase())
        }));
        info(`Found ${results.length} note(s) (fuzzy, threshold: ${threshold}):`);
        scored.forEach(({ note, score }) => {
          const percentage = Math.round(score * 100);
          console.log(`${formatNote(note)} ${chalk.gray(`[${percentage}%]`)}`);
        });
      } else {
        info(`Found ${results.length} note(s):`);
        results.forEach(note => {
          console.log(formatNote(note));
        });
      }
    });
};
