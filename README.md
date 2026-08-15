# ikendoit-graph-stuff

An Obsidian plugin for exploring notes as an interactive graph across desktop and mobile.

## What it does

- builds graph nodes and links from markdown notes
- renders an interactive D3-based graph view
- supports node avatars, detail panels, search, and map-aware metadata
- is designed to work in both desktop and mobile Obsidian

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## BRAT install

This plugin is set up to be installable through BRAT from GitHub releases in:

`ikendoit/ikendoit-graph-stuff`

Recommended device workflow:

1. Install BRAT on each device.
2. In BRAT, add the beta plugin by GitHub repo:
   `ikendoit/ikendoit-graph-stuff`
3. Use BRAT to check for updates after a new GitHub release lands.

## Release workflow

For BRAT updates, the important unit is a GitHub release whose tag matches the plugin version.

Recommended flow:

1. Make code changes in the repo.
2. Bump the plugin version in `package.json`.
3. Run `npm run build`.
4. Commit and push.
5. Push a matching Git tag such as `1.0.4`.

The GitHub Actions release workflow then publishes release assets with:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

## Local vault sync helper

For local development on one machine, the repo also includes:

```bash
npm run sync-to-mobile-app
```

That script updates the local runtime vault copy and publishes a synced release bundle into the vault as a backup recovery path.

## Notes

- `main.js` is intentionally committed so BRAT can install directly from the repo.
- `manifest.json`, `styles.css`, and `versions.json` stay at the repo root for Obsidian plugin compatibility.

## For AI agents

Cursor agents should start at `AGENTS.md`, then `MEMORY.md` and `TOOLS.md`.

A separate OpenClaw knowledge workspace may exist on Trung's machine at:

`/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/`

That local store is a companion, not a replacement for this repo. Harmonization notes: `memory/openclaw-harmonization.md`.
