#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package');
const fs = require('fs');
const path = require('path');

program
  .name('memo')
  .description('CLI tool for quick notes')
  .version(pkg.version);

// Auto-discover command modules in the commands directory
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir)
  .filter(file => file.endsWith('.js') && !file.startsWith('.'));

for (const file of commandFiles) {
  const cmdPath = path.join(commandsDir, file);
  const register = require(cmdPath);
  if (typeof register === 'function') {
    register(program);
  } else {
    console.warn(`Skipping ${file}: exported value is not a function`);
  }
}

program.parse();
