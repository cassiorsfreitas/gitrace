<img src="build/AppIcon128.png" alt="Gitrace" width="128" />

# Gitrace

Pre-commit diff review and commit flow for macOS.

## Requirements

- macOS
- Node.js v22+
- Git

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

## Test

```bash
npm test
```

## Layout

The app has four columns:

| Column | Name | Description |
|--------|------|-------------|
| 1 | NavRail | Switch between repositories |
| 2 | FileTreePanel | Staged/unstaged files — stage or unstage with `Space` |
| 3 | DiffCanvas | Unified diff viewer for the selected file |
| 4 | CommitArea | Commit message, pre-commit hook output, and commit button |

## Keybindings

Keybindings are stored at `~/.gitrace/keybindings.json` and created automatically on first run.

Default bindings:

| Action | Key |
|--------|-----|
| Next line | `j` |
| Prev line | `k` |
| Next file | `Ctrl+J` |
| Prev file | `Ctrl+K` |
| Toggle stage | `Space` |
| Commit | `Cmd+Enter` |
| Focus left | `Ctrl+H` |
| Focus right | `Ctrl+L` |
| Open in editor | `o` |
| Command palette | `Cmd+K` |
| Edit keybindings | `Cmd+,` |

Edit `~/.gitrace/keybindings.json` directly — changes are picked up without restarting the app.
