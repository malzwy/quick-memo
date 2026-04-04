# Quick Memo

⚡ A lightning-fast CLI tool for capturing and organizing notes with tags.

## ✨ Features

- **Add notes** with optional comma-separated tags
- **List notes** with optional tag filter (`memo list <tag>`)
- **Search notes** by content (case-insensitive)
- **Delete notes** by ID (`memo delete <id>`)
- **Edit notes** by ID (`memo edit <id> <new-text> [new-tags...]`)
- **Statistics** showing total notes and tag frequency
- **JSON output** for scripting and automation (`-j` flag)
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

### List all notes

```bash
memo list
```

Output:
```
[abc123] Buy groceries (grocery, urgent)
[def456] Prepare presentation (work)
```

### Filter by tag

```bash
memo list grocery
```

### JSON output (for scripting)

```bash
memo list -j
```

### Delete a note

```bash
memo delete abc123
```

### Edit a note

```bash
memo edit abc123 "Buy organic groceries" grocery urgent
```

### Detailed view (with timestamps)

```bash
memo list -d
```

### Search notes

```bash
memo search "presentation"
```

### Show statistics

```bash
memo stats
```

Output:
```
Total notes: 15
Tag usage:
  work: 7
  personal: 5
  urgent: 3
```

## 🗃️ Storage

Notes are stored in `~/.quick-memo/notes.json`. You can back up this file to migrate your notes. The format:

```json
[
  {
    "id": "abc123",
    "content": "Buy groceries",
    "tags": ["grocery", "urgent"],
    "createdAt": 1701624000000
  }
]
```

If you want to use a custom location, set the `QUICK_MEMO_PATH` environment variable:

```bash
export QUICK_MEMO_PATH="/path/to/notes.json"
```

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

Potential future features:
- Tag autocomplete
- Export to Markdown (CSV, JSON)
- Due dates and reminders
- Fuzzy search
- Colorized output
- Backup and restore commands

---

Made with ❤️ by the OpenClaw team.