# AGENT GUIDE — ikendoit-graph-stuff

Lightweight pointer. The full Cursor-side knowledge base is:

| File | Role |
| --- | --- |
| `AGENTS.md` | How Cursor agents should work this repo |
| `MEMORY.md` | Durable project memory |
| `TOOLS.md` | Build, BRAT, release, vault paths |
| `memory/` | Topic notes (toolbox, architecture, OpenClaw sync) |

OpenClaw companion (Trung's machine, not in git):

`/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/`

## Project shape

`ikendoit-graph-stuff` is an Obsidian plugin that reads markdown notes, builds graph data, and renders an interactive graph-oriented workspace with D3, plus a Leaflet map mode.

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

Details: `TOOLS.md`.

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

## Current product focus

Grow the **node toolbox** (hold-to-reveal bubbles) from show/unshow neighbors into a real per-node command surface. See `memory/node-toolbox.md`.
