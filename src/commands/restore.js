const Store = require('../lib/store');
const { success, error } = require('../lib/helpers');
const fs = require('fs');

module.exports = function registerRestoreCommand(program) {
  program
    .command('restore <path>')
    .description('Restore notes from backup file')
    .action((backupPath) => {
      if (!fs.existsSync(backupPath)) {
        error(`Backup file not found: ${backupPath}`);
        process.exit(1);
      }
      try {
        const data = fs.readFileSync(backupPath, 'utf8');
        const notes = JSON.parse(data);
        if (!Array.isArray(notes)) {
          error('Invalid backup format: expected array of notes');
          process.exit(1);
        }
        const store = new Store();
        store.saveNotes(notes);
        success(`Restored ${notes.length} note(s) from ${backupPath}`);
      } catch (err) {
        error(`Restore failed: ${err.message}`);
        process.exit(1);
      }
    });
};
