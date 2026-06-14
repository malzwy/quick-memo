const chalk = require('chalk');

function success(msg) {
  console.log(chalk.green('✓ ' + msg));
}

function error(msg) {
  console.error(chalk.red('✗ ' + msg));
}

function warn(msg) {
  console.log(chalk.yellow('⚠ ' + msg));
}

function info(msg) {
  console.log(chalk.blue('ℹ ' + msg));
}

function formatNote(note, detailed = false, masker = null, unmasked = false) {
  let content = note.content;
  if (masker && !unmasked) {
    content = masker.maskText(content);
  }
  const date = new Date(note.createdAt).toLocaleString();
  const dateStr = detailed ? ` (${date})` : '';
  const tags = chalk.gray(note.tags.join(', '));
  return `[${chalk.cyan(note.id)}] ${content} ${tags}${dateStr}`;
}

module.exports = {
  success,
  error,
  warn,
  info,
  formatNote
};
