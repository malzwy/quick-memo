const Store = require('../lib/store');
const { success, error, info } = require('../lib/helpers');

module.exports = function registerEditCommand(program) {
  program
    .command('edit <id> <new-text>')
    .description('Edit a note\'s content')
    .argument('[new-tags...]', 'New tags (optional, replaces existing)')
    .action((id, newText, newTags) => {
      const trimmed = newText.trim();
      if (!trimmed) {
        error('Note content cannot be empty');
        process.exit(1);
      }
      const store = new Store();
      const notes = store.getNotes();
      const noteIndex = notes.findIndex(n => n.id === id);
      if (noteIndex === -1) {
        error(`Note with ID ${id} not found.`);
        process.exit(1);
      }
      const updated = {
        ...notes[noteIndex],
        content: trimmed,
        tags: newTags || notes[noteIndex].tags,
        updatedAt: Date.now()
      };
      notes[noteIndex] = updated;
      try {
        store.saveNotes(notes);
        success(`Updated note ${id}: ${updated.content}`);
        if (newTags && newTags.length > 0) {
          info(`Tags updated to: ${newTags.join(', ')}`);
        }
      } catch (err) {
        error(`Failed to update note: ${err.message}`);
        process.exit(1);
      }
    });
};
