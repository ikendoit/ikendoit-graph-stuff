# Synced Plugin Release

This folder is the cross-device release bundle for `ikendoit-graph-stuff`.

## What it is for

- `main.js`, `manifest.json`, `styles.css`, and `versions.json` live here so normal vault sync can carry them to other devices.
- Newer plugin builds can copy these files into `.obsidian/plugins/ikendoit-graph-stuff` locally on each device.

## One-time bootstrap for devices still stuck on an old plugin version

- Windows: run `install_from_vault_bundle.ps1`
- macOS / Linux / WSL: run `bash install_from_vault_bundle.sh`

That installs the bundled runtime files into the local Obsidian plugin folder for this vault.

## After bootstrap

- Future builds are published back into this same synced bundle.
- Plugin versions that include the synced-release updater can apply newer bundled releases from inside Obsidian by startup or with the command:
  `Apply synced plugin release from vault`
