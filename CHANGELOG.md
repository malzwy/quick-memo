# Changelog

All notable changes to Quick Memo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-04-10

### Fixed
- Fixed backup command crash when called without arguments (parameter shadowing)
- Ensured backup directory exists for custom paths
- Updated documentation to include trash commands and CSV export

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
[1.1.1]: https://github.com/malzwy/quick-memo/releases/tag/v1.1.1
[1.1.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.1.0
[1.0.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.0.0