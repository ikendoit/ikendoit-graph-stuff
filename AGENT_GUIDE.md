# AGENT GUIDE — ikendoit-graph-stuff

This is the lightweight development handoff for future coding sessions.

## Project shape

`ikendoit-graph-stuff` is an Obsidian plugin that reads markdown notes, builds graph data, and renders an interactive graph-oriented workspace with D3.

Primary files:

- `main.ts`
- `styles.css`
- `manifest.json`
- `package.json`
- `utils/constants.ts`
- `utils/canvas_panel_display.ts`
- `utils/graph_state.ts`

## Working agreement

- Treat this repo as the only source of truth for plugin code.
- Build here before testing or publishing.
- Avoid editing separate runtime plugin copies directly.

## Commands

- `npm run dev`
- `npm run build`
- `npm run sync-to-mobile-app`

## Delivery model

Preferred cross-platform delivery:

- GitHub repo plus BRAT for desktop, laptop, and mobile installs

Secondary recovery path:

- local runtime sync plus the `_ikg-plugin-sync/ikendoit-graph-stuff` vault bundle

## Publish hygiene

- Do not commit secrets, tokens, or personal note content.
- Keep `main.js` committed because BRAT installs from repo contents.
- Keep runtime plugin files at the repo root:
  - `main.js`
  - `manifest.json`
  - `styles.css`
  - `versions.json`
