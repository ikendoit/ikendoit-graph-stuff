# BRAT and release delivery

Trung loads this plugin on multiple devices with **BRAT**, not the Obsidian marketplace.

## Why that matters to agents

- User-visible “I have the new version” means a **GitHub Release**, not only a commit.
- `main.js` must remain at repo root and stay in git.
- `manifest.json` `version` must match the git tag (workflow compares them).
- `isDesktopOnly` is false. Do not add Electron-only APIs without a mobile fallback.

## Happy path

```
code in this repo
  → npm run build
  → bump version (package.json + npm run version)
  → commit main.js + manifest + versions + source
  → git tag <version> && push tag
  → Actions uploads release assets
  → BRAT check for updates on each device
```

Repo BRAT id: `ikendoit/ikendoit-graph-stuff`.

## Unhappy path (vault bundle)

Used when a device cannot talk to GitHub/BRAT easily, or is stuck on an old copy:

- `copy_to_remote_vault.sh` writes plugin files + `_ikg-plugin-sync/ikendoit-graph-stuff/`.
- Plugin command `Apply synced plugin release from vault`.
- Restart Obsidian.

Do not invent a third installer. Do not tell Trung to manually copy `main.js` unless both BRAT and the bundle failed.

## Local test vault (Trung)

Runtime copy only:

`/home/trkenng/Obsidian-gifts/Obsidian-Vault Test-plugins/Obsidian-Vault Test-plugins/.obsidian/plugins/ikendoit-graph-stuff`

Edit source in git, build, then sync or BRAT-update. Editing that folder directly creates drift.
