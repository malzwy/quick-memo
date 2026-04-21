const Store = require('../lib/store');
const { success, error } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = function registerExportCsvCommand(program) {
  program
    .command('export-csv [outputPath]')
    .description('Export notes to CSV file')
    .option('--no-header', 'Skip CSV header row')
    .action((outputPath, options) => {
      const store = new Store();
      const notes = store.getNotes();
      if (notes.length === 0) {
        console.log(chalk.yellow('No notes to export'));
        return;
      }

      const exportPath = outputPath || path.join(process.cwd(), 'quick-memo-export.csv');

      // Escape CSV fields per RFC 4180
      function escapeCsv(value) {
        if (value == null) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }

      try {
        let csv = '';
        if (options.header !== false) { // --no-header sets header=false to skip
          csv += 'ID,Content,Tags,Created,Updated\n';
        }
        notes.forEach(note => {
          const id = escapeCsv(note.id);
          const content = escapeCsv(note.content);
          const tags = escapeCsv(note.tags.join(';'));
          const created = escapeCsv(new Date(note.createdAt).toISOString());
          const updated = escapeCsv(note.updatedAt ? new Date(note.updatedAt).toISOString() : '');
          csv += `${id},${content},${tags},${created},${updated}\n`;
        });
        fs.writeFileSync(exportPath, csv);
        success(`Exported ${notes.length} note(s) to: ${exportPath}`);
      } catch (err) {
        error(`CSV export failed: ${err.message}`);
        process.exit(1);
      }
    });
};
