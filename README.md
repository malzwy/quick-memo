# Quick Memo

A simple CLI tool for taking and managing notes.

## Installation

```bash
npm install -g quick-memo
```

## Usage

```bash
# Add a note with optional tags
memo add "Buy groceries" grocery

# List all notes
memo list

# Filter by tag
memo list grocery

# Search notes
memo search "meeting"

# Show statistics
memo stats
```

## Features

- Add notes with optional tags
- List notes with optional tag filter
- Search notes by content
- Basic statistics (total notes, tag usage)
- Local JSON storage (~/.quick-memo/notes.json)

## License

MIT