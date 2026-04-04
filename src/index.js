#!/usr/bin/env node

const { program } = require('commander');
const Store = require('./lib/store');
const { generateId } = require('./lib/utils');

program
  .name('memo')
  .description('CLI tool for quick notes')
  .version('1.0.0');

program
  .command('add <text> [tags...]')
  .description('Add a new note with optional tags')
  .action((text, tags) => {
    const store = new Store();
    const note = {
      id: generateId(),
      content: text,
      tags: tags || [],
      createdAt: Date.now()
    };
    store.addNote(note);
    console.log(`Note added with ID: ${note.id}`);
  });

program
  .command('list [tag]')
  .description('List all notes, optionally filtered by tag')
  .option('-d, --detailed', 'Show full details including timestamps')
  .option('-j, --json', 'Output in JSON format')
  .action((tag, options) => {
    const store = new Store();
    const notes = store.getNotes();
    const filtered = tag ? notes.filter(n => n.tags.includes(tag)) : notes;
    
    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }
    
    if (filtered.length === 0) {
      console.log('No notes found.');
      return;
    }
    filtered.forEach(note => {
      if (options.detailed) {
        const date = new Date(note.createdAt).toLocaleString();
        console.log(`[${note.id}] ${note.content}`);
        console.log(`  Tags: ${note.tags.join(', ')}`);
        console.log(`  Created: ${date}`);
      } else {
        console.log(`[${note.id}] ${note.content} (${note.tags.join(', ')})`);
      }
    });
  });

program
  .command('search <query>')
  .description('Search notes by content')
  .action((query) => {
    const store = new Store();
    const notes = store.getNotes();
    const results = notes.filter(n => n.content.toLowerCase().includes(query.toLowerCase()));
    if (results.length === 0) {
      console.log('No matching notes found.');
      return;
    }
    results.forEach(note => {
      console.log(`[${note.id}] ${note.content} (${note.tags.join(', ')})`);
    });
  });

program
  .command('delete <id>')
  .description('Delete a note by ID')
  .action((id) => {
    const store = new Store();
    const notes = store.getNotes();
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) {
      console.error(`Note with ID ${id} not found.`);
      process.exit(1);
    }
    const deleted = notes.splice(index, 1)[0];
    store.saveNotes(notes);
    console.log(`Deleted note: ${deleted.content}`);
  });

program
  .command('edit <id> <new-text>')
  .description('Edit a note\'s content')
  .argument('[new-tags...]', 'New tags (optional, replaces existing)')
  .action((id, newText, newTags) => {
    const store = new Store();
    const notes = store.getNotes();
    const noteIndex = notes.findIndex(n => n.id === id);
    if (noteIndex === -1) {
      console.error(`Note with ID ${id} not found.`);
      process.exit(1);
    }
    if (!newText.trim()) {
      console.error('Note content cannot be empty.');
      process.exit(1);
    }
    const updated = {
      ...notes[noteIndex],
      content: newText,
      tags: newTags || notes[noteIndex].tags,
      updatedAt: Date.now()
    };
    notes[noteIndex] = updated;
    store.saveNotes(notes);
    console.log(`Updated note ${id}: ${updated.content}`);
  });

program
  .command('stats')
  .description('Show statistics about your notes')
  .action(() => {
    const store = new Store();
    const notes = store.getNotes();
    const total = notes.length;
    const tags = {};
    notes.forEach(n => {
      n.tags.forEach(t => {
        tags[t] = (tags[t] || 0) + 1;
      });
    });
    console.log(`Total notes: ${total}`);
    console.log('Tag usage:');
    Object.entries(tags).sort((a,b) => b[1] - a[1]).forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });
  });

program.parse();