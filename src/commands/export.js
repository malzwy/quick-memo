const Store = require('../lib/store');
const { success, info, error } = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = function registerExportCommand(program) {
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
};
