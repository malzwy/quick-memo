#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package');
const Store = require('./lib/store');
const { generateId } = require('./lib/utils');
const { loadConfig, getCommandConfig } = require('./lib/config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const stringSimilarity = require('string-similarity');

// Helper functions
function success(msg) { console.log(chalk.green('✓ ' + msg)); }
function error(msg) { console.error(chalk.red('✗ ' + msg)); }
function warn(msg) { console.log(chalk.yellow('⚠ ' + msg)); }
function info(msg) { console.log(chalk.blue('ℹ ' + msg)); }
function formatNote(note, detailed = false) {
  const date = new Date(note.createdAt).toLocaleString();
  const dateStr = detailed ? ` (${date})` : '';
  const tags = chalk.gray(note.tags.join(', '));
  return `[${chalk.cyan(note.id)}] ${note.content} ${tags}${dateStr}`;
}

program
  .name('memo')
  .description('CLI tool for quick notes')
  .version(pkg.version);

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

program
  .command('list [tag]')
  .description('List all notes, optionally filtered by tag')
  .option('-d, --detailed', 'Show full details including timestamps')
  .option('-j, --json', 'Output in JSON format')
  .option('-s, --sort <field>', 'Sort by: created (default), updated, or content', null)
  .option('--asc', 'Sort ascending (default is descending for date fields)')
  .action((tag, options) => {
    const store = new Store();
    // Load and merge config
    const config = loadConfig();
    const listConfig = getCommandConfig(config, 'list', options);

    let notes = store.getNotes();
    const filtered = tag ? notes.filter(n => n.tags.includes(tag)) : notes;
    
    // Sort notes using effective config
    filtered.sort((a, b) => {
      let valA, valB;
      switch (listConfig.sortBy) {
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
      if (valA < valB) return listConfig.sortAsc ? -1 : 1;
      if (valA > valB) return listConfig.sortAsc ? 1 : -1;
      return 0;
    });
    
    if (listConfig.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }
    
    if (filtered.length === 0) {
      info('No notes found.');
      return;
    }
    
    filtered.forEach(note => {
      if (listConfig.detailed) {
        const date = new Date(note.createdAt).toLocaleString();
        const updated = note.updatedAt ? `\n  Updated: ${new Date(note.updatedAt).toLocaleString()}` : '';
        console.log(`[${chalk.cyan(note.id)}] ${note.content}`);
        console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
        console.log(`  ${chalk.gray('Created:')} ${date}${updated}`);
      } else {
        console.log(formatNote(note));
      }
    });
    
    info(`Total: ${filtered.length} note(s)`);
  });

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
      error('Search query cannot be empty');
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
        error('Threshold must be a number between 0 and 1');
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

program
  .command('delete <id>')
  .description('Delete a note by ID')
  .option('-f, --force', 'Skip confirmation prompt')
  .action((id, options) => {
    const store = new Store();
    // Load config for confirmation settings
    const config = loadConfig();
    const deleteConfig = getCommandConfig(config, 'delete', options);

    const notes = store.getNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
      error(`Note with ID ${id} not found.`);
      process.exit(1);
    }
    const deleted = notes[index];
    
    // Determine if confirmation is needed
    const skipConfirm = options.force || !deleteConfig.confirm;
    if (!skipConfirm) {
      console.log(`About to delete: ${chalk.yellow(deleted.content)}`);
      console.log(`${chalk.gray('Tags:')} ${deleted.tags.join(', ') || 'none'}`);
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const question = chalk.red('Are you sure? (y/N): ');
      rl.question(question, (answer) => {
        rl.close();
        if (!answer || answer.toLowerCase() !== 'y') {
          info('Deletion cancelled');
          return;
        }
        performDelete();
      });
    } else {
      performDelete();
    }
    
    function performDelete() {
      const newNotes = notes.filter(n => n.id !== id);
      try {
        store.saveNotes(newNotes);
        success(`Deleted note: ${deleted.content}`);
      } catch (err) {
        error(`Failed to delete note: ${err.message}`);
        process.exit(1);
      }
    }
  });

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

program
  .command('stats')
  .description('Show statistics about your notes')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    const store = new Store();
    const notes = store.getNotes();
    const total = notes.length;
    const tags = {};
    notes.forEach(n => {
      n.tags.forEach(t => {
        tags[t] = (tags[t] || 0) + 1;
      });
    });
    if (options.json) {
      const output = { total, tags };
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(`\n${chalk.bold('📊 Quick Memo Statistics')}`);
    console.log(`Total notes: ${chalk.cyan(total.toString())}`);
    if (Object.keys(tags).length > 0) {
      console.log(chalk.gray('\nTag usage:'));
      Object.entries(tags).sort((a,b) => b[1] - a[1]).forEach(([tag, count]) => {
        console.log(`  ${chalk.yellow(tag.padEnd(15))} ${count}`);
      });
    } else {
      info('No tags used yet');
    }
  });

program
  .command('tags')
  .description('List all tags used across notes')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    const store = new Store();
    const notes = store.getNotes();
    const tags = {};
    notes.forEach(n => {
      n.tags.forEach(t => {
        tags[t] = (tags[t] || 0) + 1;
      });
    });
    const tagList = Object.entries(tags).sort((a,b) => b[1] - a[1]);
    if (options.json) {
      const tagsObj = Object.fromEntries(tagList);
      console.log(JSON.stringify({ tags: tagsObj }, null, 2));
      return;
    }
    if (tagList.length === 0) {
      info('No tags found. Add a note with tags to get started!');
      return;
    }
    console.log(chalk.bold('🏷️  Tags'));
    tagList.forEach(([tag, count]) => {
      console.log(`  ${chalk.green(tag)} ${chalk.gray(`(${count} note${count !== 1 ? 's' : ''})`)}`);
    });
  });

// Import command - bulk import from JSON or CSV
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
        // Parse CSV (same format as export-csv)
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          error('CSV file must have header and at least one data row');
          process.exit(1);
        }
        const header = lines[0].split(',');
        if (!header.includes('Content') || !header.includes('Tags')) {
          error('CSV file must have Content and Tags columns');
          process.exit(1);
        }
        
        const existingNotes = store.getNotes();
        const existingContents = new Set(existingNotes.map(n => n.content.toLowerCase()));
        
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          // Simple CSV parsing for quoted fields
          const parsed = [];
          let inQuotes = false;
          let current = '';
          for (let j = 0; j < row.length; j++) {
            const char = row[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              parsed.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          parsed.push(current);
          
          if (parsed.length < 2) {
            skipped++;
            continue;
          }
          const content = parsed[1].trim();
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
          const tagsStr = parsed[2] || '';
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

// Backup command
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

// Restore command
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

// Export command (Markdown)
program
  .command('export [outputPath]')
  .description('Export notes to Markdown file')
  .option('-t, --tags', 'Include tag summary at the end')
  .action((outputPath, options) => {
    const store = new Store();
    const notes = store.getNotes();
    if (notes.length === 0) {
      info('No notes to export');
      return;
    }
    
    const exportPath = outputPath || path.join(process.cwd(), 'quick-memo-export.md');
    let md = `# Quick Memo Export\n\nGenerated: ${new Date().toLocaleString()}\nTotal notes: ${notes.length}\n\n`;
    
    notes.forEach((note, idx) => {
      md += `## ${idx + 1}. ${note.content}\n\n`;
      md += `**ID:** ${note.id}  \n`;
      md += `**Created:** ${new Date(note.createdAt).toLocaleString()}`;
      if (note.updatedAt) {
        md += `  \n**Updated:** ${new Date(note.updatedAt).toLocaleString()}`;
      }
      md += `\n**Tags:** ${note.tags.length > 0 ? note.tags.join(', ') : 'none'}\n\n`;
      md += `---\n\n`;
    });
    
    if (options.tags) {
      const tagCounts = {};
      notes.forEach(n => n.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
      md += `# Tag Summary\n\n`;
      Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).forEach(([tag, count]) => {
        md += `- ${tag}: ${count}\n`;
      });
    }
    
    try {
      fs.writeFileSync(exportPath, md);
      success(`Exported ${notes.length} note(s) to: ${exportPath}`);
    } catch (err) {
      error(`Export failed: ${err.message}`);
      process.exit(1);
    }
  });

// Export CSV command
program
  .command('export-csv [outputPath]')
  .description('Export notes to CSV file')
  .option('--no-header', 'Skip CSV header row')
  .action((outputPath, options) => {
    const store = new Store();
    const notes = store.getNotes();
    if (notes.length === 0) {
      info('No notes to export');
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
      if (options.header) {
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

// Trash commands
program
  .command('trash <id>')
  .description('Move note to trash (soft delete)')
  .action((id) => {
    const store = new Store();
    const trashed = store.trashNote(id);
    success(`Moved to trash: ${trashed.content}`);
    info(`Trashed at: ${new Date(trashed.trashedAt).toLocaleString()}`);
  });

program
  .command('trash-restore <id>')
  .description('Restore note from trash')
  .action((id) => {
    const store = new Store();
    const restored = store.restoreNote(id);
    success(`Restored: ${restored.content}`);
    info(`Restored at: ${new Date(restored.createdAt).toLocaleString()}`);
  });

program
  .command('trash-list')
  .description('List all trashed notes')
  .option('-d, --detailed', 'Show full details including timestamps')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    const store = new Store();
    const trash = store.getTrashNotes();
    
    if (options.json) {
      console.log(JSON.stringify(trash, null, 2));
      return;
    }
    
    if (trash.length === 0) {
      info('Trash is empty');
      return;
    }
    
    if (options.detailed) {
      trash.forEach(note => {
        const date = new Date(note.trashedAt).toLocaleString();
        console.log(`[${chalk.cyan(note.id)}] ${note.content}`);
        console.log(`  ${chalk.gray('Trashed:')} ${date}`);
        if (note.tags && note.tags.length > 0) {
          console.log(`  ${chalk.gray('Tags:')} ${note.tags.join(', ')}`);
        }
        console.log();
      });
    } else {
      trash.forEach(note => {
        const date = new Date(note.trashedAt).toLocaleString();
        console.log(`[${chalk.cyan(note.id)}] ${note.content} ${chalk.gray(`(${date})`)}`);
      });
    }
    
    info(`Total: ${trash.length} note(s) in trash`);
  });

program
  .command('trash-empty')
  .description('Permanently delete all trashed notes')
  .option('-f, --force', 'Skip confirmation prompt')
  .action((options) => {
    const store = new Store();
    // Load config for confirmation settings
    const config = loadConfig();
    const confirmConfig = getCommandConfig(config, 'trash-empty', options);

    const trash = store.getTrashNotes();
    
    if (trash.length === 0) {
      info('Trash is already empty');
      return;
    }
    
    const skipConfirm = options.force || !confirmConfig.confirm;
    if (!skipConfirm) {
      console.log(`About to permanently delete ${trash.length} note(s) from trash:`);
      console.log();
      trash.forEach(note => {
        console.log(`- ${note.content}`);
      });
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const question = chalk.red('Are you sure? This cannot be undone. (y/N): ');
      rl.question(question, (answer) => {
        rl.close();
        if (!answer || answer.toLowerCase() !== 'y') {
          info('Empty trash cancelled');
          return;
        }
        performEmptyTrash();
      });
    } else {
      performEmptyTrash();
    }
    
    function performEmptyTrash() {
      store.emptyTrash();
      success(`Emptyed trash: ${trash.length} note(s) permanently deleted`);
    }
  });

program
  .command('purge <id>')
  .description('Permanently delete a single note from trash')
  .option('-f, --force', 'Skip confirmation prompt')
  .action((id, options) => {
    const store = new Store();
    // Load config for confirmation settings
    const config = loadConfig();
    const confirmConfig = getCommandConfig(config, 'purge', options);

    const trash = store.getTrashNotes();
    const index = trash.findIndex(n => n.id === id);
    if (index === -1) {
      error(`Note with ID ${id} not found in trash.`);
      process.exit(1);
    }
    const toDelete = trash[index];

    const skipConfirm = options.force || !confirmConfig.confirm;
    if (!skipConfirm) {
      console.log(`About to permanently delete: ${chalk.yellow(toDelete.content)}`);
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const question = chalk.red('Are you sure? This cannot be undone. (y/N): ');
      rl.question(question, (answer) => {
        rl.close();
        if (!answer || answer.toLowerCase() !== 'y') {
          info('Purge cancelled');
          return;
        }
        performPurge();
      });
    } else {
      performPurge();
    }

    function performPurge() {
      store.permanentlyDelete(id);
      success(`Purged note: ${toDelete.content}`);
    }
  });

program.parse();