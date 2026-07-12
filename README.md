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

This plugin is set up to be installable through BRAT from the GitHub repo:

`ikendoit/ikendoit-graph-stuff`

Recommended device workflow:

1. Install BRAT on each device.
2. In BRAT, add the beta plugin by GitHub repo:
   `ikendoit/ikendoit-graph-stuff`
3. Use BRAT to check for updates after new commits land.

## Local vault sync helper

For local development on one machine, the repo also includes:

```bash
npm run sync-to-mobile-app
```

That script updates the local runtime vault copy and publishes a synced release bundle into the vault as a backup recovery path.

## Notes

- `main.js` is intentionally committed so BRAT can install directly from the repo.
- `manifest.json`, `styles.css`, and `versions.json` stay at the repo root for Obsidian plugin compatibility.
