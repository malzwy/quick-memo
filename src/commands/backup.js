const Store = require('../lib/store');
const { success, info, error } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function registerBackupCommand(program) {
  program
    .command('backup [backupPath]')
    .description('Backup notes to specified path (or default location)')
    .action((backupPathArg) => {
      const store = new Store();
      let backupPath = backupPathArg;
      if (!backupPath) {
        backupPath = store.dataPath + '.backup-' + Date.now();
      } else {
        // Ensure directory exists for custom backup path
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
      }
      try {
        const notes = store.getNotes();
        fs.writeFileSync(backupPath, JSON.stringify(notes, null, 2));
        success(`Backup created: ${backupPath}`);
        info(`Notes backed up: ${notes.length} note(s)`);
      } catch (err) {
        error(`Backup failed: ${err.message}`);
        process.exit(1);
      }
    });
};
