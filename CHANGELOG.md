# Changelog

All notable changes to Quick Memo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/malzwy/quick-memo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.1.0
[1.0.0]: https://github.com/malzwy/quick-memo/releases/tag/v1.0.0