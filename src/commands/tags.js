const Store = require('../lib/store');
const { info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerTagsCommand(program) {
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
};
