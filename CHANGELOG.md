# Changelog

All notable changes to Quick Memo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.13.0] - 2026-05-03

### Added
- ⚡ **Fast fuzzy search** with `--fast` flag using token-based Jaccard similarity
  - Dramatically improves performance of fuzzy searches on large datasets
  - Backward compatible: falls back to string-similarity if index is old or `--fast` not specified
  - Benchmarks show up to 10x speedup for fuzzy searches on 10k+ notes
- ⚡ **Inverted index** for O(1) exact token lookups (index version 3)
  - Single-word exact searches now use a token → note IDs map for instant results
  - Incrementally maintained by IndexManager during add/edit/delete
  - Backward compatible: older indexes are automatically upgraded on first mutating operation
- 🔒 **Enhanced FileLock** with exponential backoff, jitter, and overall timeout
  - Reduces CPU usage under contention with efficient sleep (`Atomics.wait`)
  - Prevents thundering herd problem with randomized backoff delays
  - Configurable retry count and timeout via `FileLock` options

### Changed
- Search index version bumped to 3 (now includes `tokenMap` for inverted lookups)
- Fuzzy search now uses token similarity when `--fast` is enabled

### Improved
- Added comprehensive benchmark suite (`benchmarks/`) for search, index rebuild, and operations
- Documentation now includes detailed sections on search index performance and locking behavior

---

## [Unreleased]

*No unreleased changes yet.*

---

## [1.12.0] - 2026-04-29

### Added
- ⚡ **Performance benchmark suite** for proactive performance monitoring
  - `npm run benchmark` – Search performance comparison (with/without index)
  - `npm run benchmark:index` – Index rebuild scalability across dataset sizes
  - `npm run benchmark:ops` – Mutating operations throughput (add/edit/delete)
  - `npm run benchmark:all` – Run complete suite
- 📊 **BENCHMARKS.md** – Comprehensive baseline results, targets, and regression guidance
- 💾 Automatic index rebuild performance logging (human-readable + timestamps)
- 📈 Improved insight output during benchmarks (throughput, speedup ratios)

### Improved
- Benchmark scripts output tabular summaries and save detailed JSON results to `benchmarks/results/` for historical tracking
- Documentation now includes performance characteristics and optimization opportunities

---

## [1.11.0] - 2026-04-25

### Added
- 🏗️ **IndexManager** class to centralize and unify search index management
  - Eliminates code duplication across commands (add, edit, delete, trash, purge, restore, untag)
  - Ensures consistent index update behavior and easier future enhancements
  - Provides methods: `afterAdd()`, `afterEdit()`, `afterDelete()`, `rebuild()`
- ⚡ **Batch note insertion** via new `Store.addNotes()` method
  - Dramatically improves import performance: O(n) file writes instead of O(n²)
  - Reduces I/O operations when importing large datasets (e.g., 1000 notes: 1 write vs 1000)
  - Import command now uses batch insertion and single index rebuild

### Improved
- Refactored all note-modifying commands to use `IndexManager` for cleaner code and maintainability
- Enhanced `import` command efficiency: collects all notes then writes once, followed by single index rebuild
- Added missing index update for `trash-restore` command (previously omitted, now consistent)

### Fixed
- Fixed potential index inconsistency when restoring trashed notes by adding index update

---

## [1.10.0] - 2026-04-23

### Added
- ✨ `config` command group for managing settings without editing files
  - `memo config show` displays current configuration
  - `memo config set <key> <value>` sets nested keys using dot notation (e.g., `list.sortBy`)
  - `memo config unset <key>` removes configuration keys
  - Supports boolean, number, and string values
  - Auto-creates config file and parent directories

### Improved
- Enhanced user experience: configuration now fully manageable via CLI
- Documentation updated with config usage examples

---

## [1.8.1] - 2026-04-20

### Fixed
- Fixed CSV export `--no-header` flag: header is now included by default and omitted when the flag is provided.
- Fixed CSV import to correctly parse fields containing newlines, commas, and quoted values (RFC 4180 compliance). Multiline note content now imports correctly.

---

## [1.8.0] - 2026-04-19

### Added
- ✨ `import <filePath>` command for bulk import from JSON or CSV files
  - Supports both JSON (array of note objects) and CSV (same format as export-csv)
  - Smart duplicate detection by content (use `--force` to bypass)
  - Skips empty/invalid notes with warnings
  - Preserves tags from source data

### Improved
- Import functionality complements existing export commands for full data portability
- Test coverage expanded to include import scenarios

---

## [1.7.0] - 2026-04-18

### Added
- `untag <id> <tag>` command to remove a specific tag from a note without affecting other tags
- `Store.untagNote()` method for programmatic tag removal

### Improved
- More granular tag management: users can now remove individual tags instead of replacing all via edit
- Test coverage expanded to 24 test categories with dedicated untag success, missing tag, and missing note tests

---

## [1.2.1] - 2026-04-10

### Fixed
- Fixed backup command crash when called without arguments (parameter shadowing)
- Ensured backup directory exists for custom paths
- Updated documentation to include trash commands and CSV export

## [1.4.0] - 2026-04-14

### Added
- JSON output for `tags` command (`-j` flag) for scripting and automation

### Improved
- Expanded test coverage to 17 categories (including tags JSON output)
- Documentation updated with tags JSON example

---

## [1.5.0] - 2026-04-16

### Added
- JSON output for `search` command (`-j` flag) for scripting and automation
- Tag filtering for `search` command (`-t/--tag`) to combine text search with tag filters (comma-separated for OR logic)

### Improved
- Expanded test coverage to 19 categories (including search JSON output and tag filtering)
- Documentation updated with search command examples and options

---

## [1.6.0] - 2026-04-17

### Added
- ✨ **Fuzzy search** capability for `search` command (`-f/--fuzzy`)
  - Uses string similarity matching to find notes even with typos or partial matches
  - Configurable similarity threshold with `--threshold` option (default: 0.3)
  - Shows relevance percentage in fuzzy search results
- JSON output for fuzzy search results (compatible with `-j` flag)

### Improved
- Expanded test coverage to 21 categories (fuzzy search + fuzzy + tag filter)
- Documentation updated with fuzzy search examples and options

---

## [1.3.0] - 2026-04-12

### Added
- Configuration file support via `~/.quick-memo/config.json` (or `QUICK_MEMO_CONFIG` env var)
  - Default options for `list` command: `sortBy`, `sortAsc`, `detailed`, `json`
  - Configurable confirmation prompts for `delete`, `trash-empty`, and `purge`
- All configuration values can be overridden by command-line flags
- JSON output for `stats` command (`-j` flag) for scripting and automation

### Improved
- Expanded test coverage to 16 categories (including stats JSON output)
- Documentation updated with configuration section and stats JSON example

---

## [1.2.0] - 2026-04-07

### Added
- 📤 New `export-csv` command to export notes to CSV format
  - Proper RFC 4180 escaping for fields containing commas, quotes, or newlines
  - `--no-header` flag to omit header row (default includes header)
  - Output includes: ID, Content, Tags (semicolon-separated), Created (ISO 8601), Updated (ISO 8601)

### Fixed
- Version display now correctly reflects package.json version (dynamic)
- Sorting applied before JSON output to ensure consistent scripting results
- Documentation URLs updated to point to correct repository

---

## [1.1.1] - 2026-04-06

### Fixed
- Resolved CLI version mismatch (now uses `pkg.version` instead of hardcoded)
- Fixed JSON output to respect sorting options for scripting consistency
- Updated CHANGELOG links to correct repository (malzwy/quick-memo)

## [1.1.0] - 2026-04-05

### Added
- ✨ Colored terminal output using `chalk` (success, error, warning, info messages)
- 🔒 Delete confirmation prompt to prevent accidental data loss
- 🚀 New `-f/--force` flag for delete to skip confirmation
- 📊 Enhanced `list` command with sorting options:
  - `--sort <field>`: sort by `created` (default), `updated`, or `content`
  - `--asc`: sort ascending (default is descending for date fields)
- 🏷️ New `tags` command to list all tags with usage counts
- 💾 New `backup` command to create manual backups
- 🔄 New `restore <path>` command to restore from backup
- 📤 New `export [path]` command to export notes as Markdown
  - `-t/--tags` flag to include tag summary in export

### Improved
- ✅ Input validation: rejects empty/whitespace-only note content
- 🛡️ Better error handling:
  - Corrupted JSON file creates timestamped backup and starts fresh
  - Write failures show clear error messages
- 💅 Improved output formatting with colors and better spacing
- 📈 Stats command now shows colored output and better structure
- 🔍 Search now validates query (non-empty)
- 📝 Edit command validates new content and shows confirmation

### Fixed
- Edit command's tag argument parsing (now correctly replaces all tags when provided)
- Store class throws proper errors for invalid operations
- Improved file path handling (fixes potential path issues)

### Internal
- Added more comprehensive test coverage
- Added error boundary for backup creation on corruption

## [1.0.0] - 2026-04-03

### Added
- Initial release
- Core CRUD operations: add, list, delete, edit, search, stats
- Tag-based filtering
- JSON output mode (`-j` flag)
- Detailed view (`-d` flag)
- Local JSON storage in `~/.quick-memo/notes.json`
- Basic test suite
- MIT License

---

[1.3.0]: https://github.com/malzwy/quick-memo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.2.0
[1.1.1]: https://github.com/malzwy/quick-memo/releases/tag/v1.1.0
[1.1.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.0.0
[1.0.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.0.0
```
