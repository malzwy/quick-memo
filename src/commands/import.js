const Store = require('../lib/store');
const { generateId } = require('../lib/utils');
const { success, error, warn, info } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');

module.exports = function registerImportCommand(program) {
  program
    .command('import <filePath>')
    .description('Import notes from JSON or CSV file')
    .option('-f, --force', 'Skip confirmation for duplicate handling')
    .action((filePath, options) => {
      const store = new Store();
      if (!fs.existsSync(filePath)) {
        error(`File not found: ${filePath}`);
        process.exit(1);
      }
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        let importedNotes = [];
        let skipped = 0;
        let duplicates = 0;

        // Detect format by extension
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
          const data = JSON.parse(content);
          if (!Array.isArray(data)) {
            error('JSON file must contain an array of notes');
            process.exit(1);
          }
          // Transform to our format
          const existingNotes = store.getNotes();
          const existingContents = new Set(existingNotes.map(n => n.content.toLowerCase()));

          for (const item of data) {
            if (!item.content || !item.content.trim()) {
              skipped++;
              continue; // skip empty notes
            }
            const trimmed = item.content.trim();

            // Check for duplicates (by content) unless force
            if (!options.force && existingContents.has(trimmed.toLowerCase())) {
              duplicates++;
              continue;
            }

            const note = {
              id: generateId(),
              content: trimmed,
              tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []),
              createdAt: item.createdAt || Date.now()
            };
            importedNotes.push(note);
            existingContents.add(trimmed.toLowerCase());
          }
        } else if (ext === '.csv') {
          // Parse CSV with full RFC 4180 support (quoted fields, newlines, commas)
          function parseCsv(text) {
            // Normalize line endings
            text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              if (char === '"') {
                if (inQuotes && text[i + 1] === '"') {
                  field += '"';
                  i++; // skip next quote
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === '\n' && !inQuotes) {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
              } else if (char === ',' && !inQuotes) {
                row.push(field);
                field = '';
              } else {
                field += char;
              }
            }
            // Push last field/row (handles file without trailing newline)
            if (field || row.length > 0) {
              row.push(field);
              rows.push(row);
            }
            return rows;
          }

          const parsedCsv = parseCsv(content);
          if (parsedCsv.length < 2) {
            error('CSV file must have header and at least one data row');
            process.exit(1);
          }
          const header = parsedCsv[0];
          if (!header.includes('Content') || !header.includes('Tags')) {
            error('CSV file must have Content and Tags columns');
            process.exit(1);
          }

          const existingNotes = store.getNotes();
          const existingContents = new Set(existingNotes.map(n => n.content.toLowerCase()));

          // Process data rows (skip header)
          for (let i = 1; i < parsedCsv.length; i++) {
            const row = parsedCsv[i];
            if (row.length < 3) { // need at least ID, Content, Tags
              skipped++;
              continue;
            }
            const content = (row[1] || '').trim();
            if (!content) {
              skipped++;
              continue;
            }
            // Duplicate check
            if (!options.force && existingContents.has(content.toLowerCase())) {
              duplicates++;
              continue;
            }
            // Parse tags (semicolon-separated)
            const tagsStr = (row[2] || '').trim();
            const tags = tagsStr ? tagsStr.split(';').map(t => t.trim()).filter(t => t) : [];

            const note = {
              id: generateId(),
              content: content,
              tags: tags,
              createdAt: Date.now()
            };
            importedNotes.push(note);
            existingContents.add(content.toLowerCase());
          }
        } else {
          error('Unsupported file format. Use .json or .csv files');
          process.exit(1);
        }

        if (importedNotes.length === 0) {
          info('No new notes to import');
          if (skipped > 0) info(`${skipped} notes skipped (empty content)`);
          if (duplicates > 0) info(`${duplicates} duplicates skipped (use --force to override)`);
          return;
        }

        // Add notes
        for (const note of importedNotes) {
          store.addNote(note);
        }

        success(`Imported ${importedNotes.length} note(s)`);
        if (skipped > 0) warn(`${skipped} notes skipped (empty content)`);
        if (duplicates > 0) warn(`${duplicates} duplicates skipped (use --force to import anyway)`);

      } catch (err) {
        error(`Import failed: ${err.message}`);
        process.exit(1);
      }
    });
};
