const Store = require('../lib/store');
const { success, error } = require('../lib/helpers');

module.exports = function registerUntagCommand(program) {
  program
    .command('untag <id> <tag>')
    .description('Remove a specific tag from a note')
    .action((id, tag) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) {
        error('Tag cannot be empty');
        process.exit(1);
      }
      const store = new Store();
      try {
        const result = store.untagNote(id, trimmedTag);
        if (result) {
          success(`Removed tag '${trimmedTag}' from note ${id}`);
        } else {
          error(`Tag '${trimmedTag}' not found on note ${id}.`);
          process.exit(1);
        }
      } catch (err) {
        error(`Failed to untag: ${err.message}`);
        process.exit(1);
      }
    });
};
