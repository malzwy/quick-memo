# Quick Memo

⚡ A lightning-fast CLI tool for capturing and organizing notes with tags.

## ✨ Features

- **Add notes** with optional comma-separated tags (validates non-empty content)
- **List notes** with optional tag filter, sorting, and detailed view
- **Search notes** by content with **fuzzy matching** for typos and similar words
- **Delete notes** by ID with safety confirmation (or `--force` to skip)
- **Edit notes** by ID (updates content and/or tags)
- **Statistics** showing total notes and tag frequency
- **Tag management** – list all tags with usage counts
- **Data safety** – backup/restore commands, corrupted file recovery
- **Soft delete (Trash)** – move notes to trash, restore, or permanently delete
- **Export** notes to Markdown format
- **Export to CSV** for spreadsheet/data analysis
- **JSON output** for scripting and automation (`-j` flag)
- **Colored terminal output** for better UX
- **Local storage** in `~/.quick-memo/notes.json` (portable, no cloud)
- **Zero config** – works out of the box

## 📦 Installation

```bash
npm install -g quick-memo
```

Ensure you have Node.js >= 14 installed.

## 🚀 Usage

### Add a note

```bash
memo add "Buy groceries" grocery urgent
```

Notes with empty content are rejected.

### List all notes

```bash
memo list
```

Output (colored):
```
[abc123] Buy groceries (grocery, urgent)
[def456] Prepare presentation (work)
```

### List with options

```bash
# Filter by tag
memo list grocery

# Detailed view with timestamps
memo list -d

# Sort options
memo list --sort created --asc       # Oldest first
memo list --sort updated            # Most recently updated
memo list --sort content            # Alphabetical by content

# JSON output for scripting
memo list -j
```

### Delete a note

```bash
# With confirmation prompt
memo delete abc123

# Skip confirmation (use with caution)
memo delete abc123 --force
```

### Edit a note

```bash
# Edit content only (keeps existing tags)
memo edit abc123 "Buy organic groceries"

# Edit content and replace all tags
memo edit abc123 "Buy organic groceries" grocery urgent
```

### Search notes

Search notes by content with optional tag filters and fuzzy matching.

```bash
# Basic search
memo search "presentation"

# Filter by tag (comma-separated for OR logic)
memo search "presentation" --tag work

# Combine multiple tags and text search
memo search "important" --tag work,urgent

# Fuzzy search for typos and similar words
memo search "meeting" --fuzzy

# Adjust fuzzy threshold (0-1, default 0.3)
memo search "meeting" --fuzzy --threshold 0.5

# JSON output for scripting and automation
memo search "presentation" -j
```

For scripting/automation, use `-j` to get machine-readable JSON output:

```bash
memo search "project" -j
```

JSON output example:

```json
[
  {
    "id": "abc123",
    "content": "Project kickoff",
    "tags": ["work"],
    "createdAt": 1712345678901
  }
]
```

### Show statistics

```bash
memo stats
```

Output (human-readable):
```
📊 Quick Memo Statistics
Total notes: 15

Tag usage:
  work           7
  personal       5
  urgent         3
```

For scripting/automation, use JSON output:

```bash
memo stats -j
```

JSON output:
```json
{
  "total": 15,
  "tags": {
    "work": 7,
    "personal": 5,
    "urgent": 3
  }
}
```

### List all tags

```bash
memo tags
```

Shows all tags used across notes with counts.

For scripting/automation, use JSON output:

```bash
memo tags -j
```

JSON output:

```json
{
  "tags": {
    "work": 7,
    "personal": 5,
    "urgent": 3
  }
}
```

### Backup and Restore

```bash
# Create a backup (auto-generates timestamped filename)
memo backup

# Backup to specific location
memo backup ~/backups/notes-2026-04-05.json

# Restore from backup
memo restore ~/backups/notes-2026-04-05.json
```

### Trash Commands

Quick Memo supports soft delete via a trash bin.

```bash
# Move a note to trash (soft delete)
memo trash abc123

# List all trashed notes
memo trash-list

# Restore a note from trash
memo trash-restore abc123

# Permanently delete a single note from trash (with confirmation)
memo purge abc123

# Permanently delete all trashed notes (with confirmation)
memo trash-empty

# Use --force to skip confirmation prompts
memo purge abc123 --force
memo trash-empty --force
```

Trashed notes retain their original metadata and can be restored. Use `purge` or `trash-empty` to permanently delete without recovery.

### Export to Markdown

```bash
# Export with tag summary
memo export ~/exports/my-notes.md --tags

# Export without tag summary
memo export
```

Creates a nicely formatted Markdown file with all notes and optional tag summary.

### Export to CSV

```bash
# Export with header (default)
memo export-csv ~/exports/my-notes.csv

# Export without header
memo export-csv ~/exports/my-notes.csv --no-header
```

Exports notes to CSV format with fields: ID, Content, Tags (semicolon-separated), Created (ISO 8601), Updated (ISO 8601). Useful for spreadsheet import and data analysis.

## 🗃️ Storage

Notes are stored in `~/.quick-memo/notes.json`. You can back up this file to migrate your notes. The format:

```json
[
  {
    "id": "abc123",
    "content": "Buy groceries",
    "tags": ["grocery", "urgent"],
    "createdAt": 1701624000000,
    "updatedAt": 1701700000000
  }
]
```

If you want to use a custom location, set the `QUICK_MEMO_PATH` environment variable:

```bash
export QUICK_MEMO_PATH="/path/to/notes.json"
```

## ⚙️ Configuration

Quick Memo supports a configuration file to set default options. By default, the config file is located at `~/.quick-memo/config.json`. You can override this location by setting the `QUICK_MEMO_CONFIG` environment variable.

### Supported settings

- `list.sortBy`: Default sort field for `memo list`. Options: `created`, `updated`, `content`. Default: `created`.
- `list.sortAsc`: Default sort order (boolean). `true` for ascending, `false` for descending (dates default to descending). Default: `false`.
- `list.detailed`: Default to detailed view when listing notes (boolean). Default: `false`.
- `list.json`: Default output in JSON format (boolean). Default: `false`.
- `delete.confirmDelete`: Whether to show confirmation prompt before deleting a note. Set to `false` to skip confirmation. Default: `true`.
- `trash-empty.confirmDelete`: Whether to show confirmation before emptying trash. Default: `true`.
- `purge.confirmDelete`: Whether to show confirmation before purging a single note. Default: `true`.

Configuration example:

```json
{
  "list": {
    "sortBy": "updated",
    "sortAsc": true,
    "detailed": false
  },
  "delete": {
    "confirmDelete": false
  }
}
```

Command-line flags always override configuration file settings.

### 🔄 File Recovery

If your notes file becomes corrupted, Quick Memo will:
1. Back up the corrupted file with a timestamp (`.corrupt-<timestamp>`)
2. Start with a fresh empty notes store

You can then attempt to recover data from the backup manually.

### Environment Variables

- `QUICK_MEMO_PATH` – Custom path to notes.json file

## 🧪 Testing

```bash
npm test
```

This runs a quick self-test using a temporary directory.

## 📝 License

MIT – feel free to modify and distribute.

## 🤝 Contributing

Contributions welcome! Fork the repo and open a PR.

## 🔮 Roadmap

Completed in v1.1.0:
- ✅ Colored terminal output
- ✅ Delete confirmation
- ✅ Sorting options (by created, updated, content)
- ✅ Backup and restore commands
- ✅ Export to Markdown
- ✅ Tag listing command
- ✅ Corrupted file auto-backup
- ✅ Input validation
- ✅ Improved error handling

Future ideas:
- Tag autocomplete
- Fuzzy search
- Due dates and reminders
- Configuration file for defaults
- Note categories/pinned notes

---

Made with ❤️ by the OpenClaw team.