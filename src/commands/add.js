const Store = require('../lib/store');
const { generateId } = require('../lib/utils');
const { success, error } = require('../lib/helpers');

module.exports = function registerAddCommand(program) {
  program
    .command('add <text> [tags...]')
    .description('Add a new note with optional tags')
    .action((text, tags) => {
      const trimmed = text.trim();
      if (!trimmed) {
        error('Note content cannot be empty');
        process.exit(1);
      }
      const store = new Store();
      const note = {
        id: generateId(),
        content: trimmed,
        tags: tags || [],
        createdAt: Date.now()
      };
      try {
        store.addNote(note);
        success(`Note added with ID: ${note.id}`);
      } catch (err) {
        error(`Failed to add note: ${err.message}`);
        process.exit(1);
      }
    });
};
