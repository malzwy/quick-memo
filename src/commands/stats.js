const Store = require('../lib/store');
const { info } = require('../lib/helpers');
const chalk = require('chalk');

module.exports = function registerStatsCommand(program) {
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
};
