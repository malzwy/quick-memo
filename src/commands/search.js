const Store = require('../lib/store');
const stringSimilarity = require('string-similarity');
const { info } = require('../lib/helpers');
const chalk = require('chalk');
const indexer = require('../lib/indexer');

function tokenize(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return Array.from(new Set(words));
}

module.exports = function registerSearchCommand(program) {
  program
    .command('search <query>')
    .description('Search notes by content')
    .option('-j, --json', 'Output in JSON format')
    .option('-t, --tag <tag>', 'Filter by tag (comma-separated for multiple tags)')
    .option('-f, --fuzzy', 'Enable fuzzy matching for approximate matches')
    .option('--fast', 'Use fast token-based similarity (experimental; requires indexed tokens)')
    .option('--threshold <number>', 'Similarity threshold for fuzzy search (0-1, default: 0.3)', '0.3')
    .action((query, options) => {
      const trimmed = query.trim();
      if (!trimmed) {
        console.error(chalk.red('✗ Search query cannot be empty'));
        process.exit(1);
      }
      const store = new Store();
      // Try to use index for faster search
      let notes = null;
      const indexPath = indexer.getIndexPath();
      const index = indexer.loadIndex(indexPath);
      if (index && !indexer.needsRebuild(store.dataPath, index)) {
        notes = indexer.getIndexedNotes(index);
      } else {
        notes = store.getNotes();
      }
      let results = [];
      let threshold = null;

      const queryLower = trimmed.toLowerCase();
      let scoredResults = []; // keep score information for fuzzy

      // Check if we can use inverted index (v3+ and single-word exact search)
      const useInverted = !options.fuzzy && index && index.version >= 3 && index.tokenMap;
      if (useInverted && !queryLower.includes(' ')) {
        // Single-word exact search: use inverted index
        const token = queryLower;
        const ids = index.tokenMap[token];
        if (ids) {
          // Build note map for fast lookup
          const noteMap = new Map(index.notes.map(n => [n.id, n]));
          results = ids.map(id => noteMap.get(id)).filter(Boolean);
        } else {
          results = [];
        }
      } else if (options.fuzzy) {
        threshold = parseFloat(options.threshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 1) {
          console.error(chalk.red('✗ Threshold must be a number between 0 and 1'));
          process.exit(1);
        }

        // Candidate selection: if we have tokenMap and fast mode, restrict to notes sharing tokens
        let candidateNotes = notes;
        if (options.fast && index && index.version >= 3 && index.tokenMap) {
          const queryTokens = new Set(tokenize(queryLower));
          if (queryTokens.size > 0) {
            const candidateIds = new Set();
            for (const token of queryTokens) {
              const ids = index.tokenMap[token];
              if (ids) {
                for (const id of ids) {
                  candidateIds.add(id);
                }
              }
            }
            if (candidateIds.size > 0) {
              const noteMap = new Map(index.notes.map(n => [n.id, n]));
              candidateNotes = Array.from(candidateIds).map(id => noteMap.get(id)).filter(Boolean);
            }
          }
        }

        // Fast token-based similarity if available and candidates have tokens
        const useFast = options.fast && candidateNotes.length > 0 && candidateNotes[0].tokens;
        if (useFast) {
          const queryTokens = new Set(tokenize(queryLower));
          scoredResults = candidateNotes.map(note => {
            if (!note.tokens || note.tokens.length === 0) {
              const contentLower = note.contentLower || note.content.toLowerCase();
              const similarity = stringSimilarity.compareTwoStrings(queryLower, contentLower);
              return { note, score: similarity };
            }
            let intersection = 0;
            for (const token of note.tokens) {
              if (queryTokens.has(token)) intersection++;
            }
            const union = queryTokens.size + note.tokens.length - intersection;
            const jaccard = union === 0 ? 0 : intersection / union;
            return { note, score: jaccard };
          });
        } else {
          // Traditional string similarity on candidate set
          scoredResults = candidateNotes.map(note => {
            const contentLower = note.contentLower || note.content.toLowerCase();
            const similarity = stringSimilarity.compareTwoStrings(queryLower, contentLower);
            return { note, score: similarity };
          });
        }

        // Filter by threshold and sort by score descending
        scoredResults = scoredResults.filter(item => item.score >= threshold);
        scoredResults.sort((a, b) => b.score - a.score);
        results = scoredResults.map(item => item.note);
      } else {
        // Exact search (full scan fallback)
        results = notes.filter(n => {
          const content = n.contentLower || n.content.toLowerCase();
          return content.includes(queryLower);
        });
      }

      // Apply tag filter if provided
      if (options.tag) {
        const tagFilters = options.tag.split(',').map(t => t.trim()).filter(t => t);
        if (tagFilters.length > 0) {
          results = results.filter(n => tagFilters.some(tag => n.tags.includes(tag)));
          if (options.fuzzy) {
            scoredResults = scoredResults.filter(item => tagFilters.some(tag => item.note.tags.includes(tag)));
          }
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
        // Use precomputed scores from scoredResults
        const fastAvailable = notes.length > 0 && notes[0].tokens;
        const fastLabel = options.fast && fastAvailable ? 'fast ' : '';
        info(`Found ${results.length} note(s) (fuzzy${fastLabel ? ' ' + fastLabel : ''}, threshold: ${threshold}):`);
        scoredResults.forEach(({ note, score }) => {
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
