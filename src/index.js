#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package');

program
  .name('memo')
  .description('CLI tool for quick notes')
  .version(pkg.version);

// Register all command modules
const commandModules = [
  './commands/add',
  './commands/list',
  './commands/search',
  './commands/delete',
  './commands/edit',
  './commands/untag',
  './commands/stats',
  './commands/tags',
  './commands/import',
  './commands/export',
  './commands/export-csv',
  './commands/backup',
  './commands/restore',
  './commands/trash',
  './commands/trash-restore',
  './commands/trash-list',
  './commands/trash-empty',
  './commands/purge'
];

for (const cmd of commandModules) {
  require(cmd)(program);
}

program.parse();
