# Quick Memo

⚡ A lightning-fast CLI tool for capturing and organizing notes with tags.

## ✨ Features

- **Add notes** with optional comma-separated tags (validates non-empty content)
- **List notes** with optional tag filter, sorting, and detailed view
- **Search notes** by content with **fuzzy matching** for typos and similar words
- **Search index** – fast in-memory index for large collections (auto-maintained, with `rebuild-index` command)
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
  - Data is stored in compact JSON format by default for optimal performance. Set `QUICK_MEMO_COMPACT=0` to enable human-pretty JSON for manual inspection.
- **Zero config** – works out of the box

## 🔍 Search Index Performance

Quick Memo uses a search index (`~/.quick-memo/index.json`) to speed up queries. Starting with **v1.13.0**, the index has been upgraded to **version 3** which includes an **inverted index** (token → note IDs).

For **single-word exact searches**, the inverted index allows O(1) token lookup instead of scanning all notes. This provides dramatic speedups for large collections (1000+ notes):

- ⚡️ **10-50x faster** exact search compared to full scan
- Maintained incrementally: add/edit/delete operations update the token map in-memory and persist the index efficiently
- Backward compatible: older index versions are automatically upgraded to v3 on first mutating operation.

Fuzzy search uses the inverted index to quickly narrow down candidate notes by token overlap, then applies string-similarity on a much smaller subset.

**Fuzzy search result caching** (since v1.14.0): Results are cached on disk to make repeated fuzzy queries instantaneous. The cache is automatically invalidated when the search index changes. Use `--no-cache` to bypass the cache. Cache size and TTL are configurable via `QUICK_MEMO_CACHE_SIZE` (default 100) and `QUICK_MEMO_CACHE_TTL` (default 5 minutes).

- **Debounced persistence**: Cache writes are coalesced using a 500ms debounce timer, dramatically reducing I/O during rapid incremental searches.

You can rebuild the index manually with `memo rebuild-index` if needed after external file modifications.

**Automatic reconciliation with user feedback:** When the index becomes stale (e.g., after manually editing the notes file, switching branches, or restoring from a backup), Quick Memo automatically attempts an incremental synchronization on the next mutating operation, showing a progress message and completing quickly. Only the changed notes are processed, keeping updates fast even for large collections. If the number of changes exceeds a configurable threshold (default: 5% of total notes, minimum 200), a full rebuild is performed to ensure consistency. Even when no content changes are detected (e.g., timestamp-only modifications), the index is marked fresh to avoid repeated unnecessary checks.

**Index upgrades:** Older index versions (e.g., v2 or earlier) are automatically upgraded to the current v3 format on first use, with a clear upgrade message. This includes automatic rebuild when performing a search (not just mutating commands), ensuring seamless upgrades without manual intervention.

### Recent Performance Optimizations

- **noteMap caching**: The note lookup map used by the inverted index is now cached in memory by `IndexManager`. This eliminates O(n) map reconstruction on every search operation, providing instant note retrieval for subsequent searches. The cache is lazily invalidated after any index mutation (add/edit/delete/sync), ensuring consistency while maximizing read performance.
- **Incremental sync O(n²) fix**: The incremental synchronization algorithm now uses a `Map` for O(1) note lookups during reconciliation, reducing time complexity from O(c·n) to O(c+n) where `c` is the number of changed notes and `n` is the total notes count. This dramatically speeds up index updates after small changes on large datasets (e.g., 10K+ notes).

These optimizations are particularly impactful for:
- Repeated fuzzy searches (the cache keeps noteMap ready)
- Incremental syncs after adding/editing a few notes among many (e.g., 10 changes in a 10K-note collection)
- Workflows with frequent search operations

## 📊 Performance Tuning

Quick Memo includes advanced configuration for power users with large note collections:

### Index Synchronization

When notes are modified, the search index can be updated incrementally (fast) or fully rebuilt (thorough). The sync threshold determines when a full rebuild is triggered:

```bash
# Aggressive incremental sync (rebuild only after many changes)
memo config set sync.thresholdPercent 10

# Conservative (rebuild more frequently, safer for critical data)
memo config set sync.thresholdPercent 2

# Absolute threshold (overrides percentage)
memo config set sync.thresholdAbsolute 500  # rebuild after 500 changes
```

**Default**: 5% with a floor of 200 changes. This balances performance vs. consistency.

### Performance Debugging

Enable timing diagnostics to identify slow operations:

```bash
memo config set performance.debugTiming true
```

This logs operation durations to stderr, helping you tune your configuration.

### Environment Variables

- `QUICK_MEMO_PATH` – Custom path to notes.json file
- `QUICK_MEMO_CONFIG` – Custom path to config.json file
- `QUICK_MEMO_INDEX_PATH` – Custom path to index.json file
- `QUICK_MEMO_COMPACT` – Set to `0` for human-readable JSON in data files
- `QUICK_MEMO_FSYNC` – Set to `1` for extra durability (fsync after writes, slower)
- `QUICK_MEMO_LOCK_TIMEOUT` – Lock acquisition timeout in milliseconds (default ~30000)
- `QUICK_MEMO_PARALLEL_THRESHOLD` – Minimum notes for parallel index build (default 1000)

## 🔒 Concurrency & Data Integrity

Quick Memo uses a file-based locking mechanism (`FileLock`) to prevent concurrent write corruption when multiple CLI processes access the same notes file.

**Optimized locking behavior:**
- **Exponential backoff with jitter** reduces CPU waste and prevents thundering herd under contention
- **Overall timeout** (default ~30s) prevents indefinite blocking
- **Stale lock cleanup** automatically removes locks from crashed processes
- Efficient sleep using `Atomics.wait` when available, with busy-wait fallback for compatibility

These improvements make the CLI responsive even under high contention scenarios.

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

### Remove a specific tag

Use `untag` to remove a single tag from a note while preserving other tags.

```bash
# Remove a tag from a note
memo untag abc123 urgent
```

If the tag does not exist on the note, an error is displayed.

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

# Fast fuzzy search using token-based similarity (much faster on large datasets)
# With improved scoring: notes covering all query tokens rank higher, shorter notes preferred.
memo search "meeting" --fuzzy --fast

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

### Rebuild Index

If you suspect the search index is out of date or corrupted, you can rebuild it manually:

```bash
memo rebuild-index
```

This will recreate the index from your current notes. The index is normally kept up-to-date automatically, but this command can be useful after manual edits of the notes file or if performance degrades.

### Configuration commands

Quick Memo allows managing your configuration via CLI without manually editing the config file.

```bash
# Show current configuration
memo config show

# Set a configuration value using dot notation
memo config set list.sortBy updated
memo config set list.detailed true
memo config set delete.confirmDelete false

# Unset a configuration key
memo config unset list.detailed

# Get a configuration value (useful for scripting)
memo config get list.sortBy
# With default fallback if key not found
memo config get nonexistent.key --default created

# Validate current configuration
memo config validate

# Show differences between current configuration and defaults (or another config file)
memo config diff [otherConfigPath] [--json]
```

Supported configuration keys:
- `list.sortBy`: `created`, `updated`, or `content`
- `list.sortAsc`: boolean
- `list.detailed`: boolean
- `list.json`: boolean
- `delete.confirmDelete`: boolean
- `trash-empty.confirmDelete`: boolean
- `purge.confirmDelete`: boolean

Boolean values are parsed from JSON `true`/`false` or plain strings.

Use `memo config validate` to check your configuration for errors. Invalid values will be rejected when setting with `memo config set`.

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

### Import Notes

Bulk import notes from JSON or CSV files (complements the export commands).

```bash
# Import from JSON file (array of {content, tags, createdAt?})
memo import notes.json

# Import from CSV (same format as export-csv)
memo import notes.csv

# Force import even if duplicates exist (by content)
memo import notes.json --force
```

**JSON Format**:
```json
[
  { "content": "Buy groceries", "tags": ["grocery", "urgent"] },
  { "content": "Call mom", "tags": ["personal"], "createdAt": 1712345678901 }
]
```

**Import Behavior**:
- Generates new IDs for imported notes
- Skips empty notes automatically
- Detects duplicates by content (case-insensitive) unless `--force` is used
- Preserves tags from source data
- **CSV Import**: Fully RFC 4180-compliant
  - Supports multiline content within quoted fields
  - Handles commas inside quoted fields
  - Uses semicolon-separated tags as exported by `export-csv`
- **JSON Import**: Expects array of note objects with `content` (required), `tags` (optional array), and `createdAt` (optional timestamp)

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

### Supported configuration keys:
- `list.sortBy`: `created`, `updated`, or `content`
- `list.sortAsc`: boolean
- `list.detailed`: boolean
- `list.json`: boolean
- `delete.confirmDelete`: boolean
- `trash-empty.confirmDelete`: boolean
- `purge.confirmDelete`: boolean
- `sync.thresholdPercent`: percentage of total notes that triggers full rebuild (default 5%, min 200 notes)
- `sync.thresholdAbsolute`: absolute change count that forces rebuild (overrides percent if > 0)
- `masking.autoMask`: enable automatic masking of sensitive content (default true)
- `masking.maskChar`: character used for masking (default '*')
- `masking.showStart`: number of leading characters to reveal (default 3)
- `masking.showEnd`: number of trailing characters to reveal (default 3)
- `masking.customPatterns`: array of regex patterns for detecting sensitive data
- `performance.indexRebuildBatchSize`: progress reporting batch size (advanced)
- `performance.cacheWarmupOnLoad`: pre-populate caches after index load (default true)
- `performance.debugTiming`: log operation timings (default false)

Configuration example:
```json
{
  "list": {
    "sortBy": "updated",
    "sortAsc": true
  },
  "sync": {
    "thresholdPercent": 3
  },
  "masking": {
    "autoMask": true,
    "showStart": 3,
    "showEnd": 3
  }
}
```

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

**Performance note**: Configuration is cached in-memory to minimize disk I/O. Changes made via `memo config` commands are automatically reflected due to cache invalidation.

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

Core features (v1.1.0):
- ✅ Colored terminal output
- ✅ Delete confirmation
- ✅ Sorting options
- ✅ Backup and restore
- ✅ Export to Markdown
- ✅ Tag listing
- ✅ Corrupted file auto-backup
- ✅ Input validation
- ✅ Improved error handling

Enhancements:
- ✅ CSV export (v1.2.0)
- ✅ Configuration file (v1.3.0)
- ✅ JSON output for tags, stats, search (v1.4.0-1.5.0)
- ✅ Tag filtering in search (v1.5.0)
- ✅ Fuzzy search (v1.6.0)
- ✅ Granular tag removal - untag command (v1.7.0)
- ✅ Bulk import from JSON/CSV (v1.8.0)
- ✅ Configuration management via CLI (`memo config`) (v1.10.0)
- ✅ IndexManager for consistent index updates and batch import performance (v1.11.0)

Future ideas:
- Tag autocomplete
- Due dates and reminders
- Note categories/pinned notes
---

Made with ❤️ by the OpenClaw team.