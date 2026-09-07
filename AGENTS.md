# AGENTS.md — ikendoit-graph-stuff (Cursor harness)

This is the **Cursor-side** operating manual for AI agents working on this plugin.

Read this file first. Then read `MEMORY.md`. For commands and install paths, read `TOOLS.md`. Topic notes live in `memory/`.

This repo is the only source of truth for plugin code. Cloud agents often cannot see Trung's local OpenClaw files; those stay on his machine and remain a companion knowledge store.

## Who this is for

- Cursor Cloud Agents and local Cursor agents
- Future sessions that must continue this project **without** the previous OpenClaw chat
- Dual-agent work that should stay compatible with the OpenClaw friend

## Project in one sentence

`ikendoit-graph-stuff` is an Obsidian plugin that turns markdown notes into an interactive D3 graph plus a Leaflet map, installed on desktop and mobile through BRAT.

## Start here every session

1. Read `MEMORY.md` (durable project knowledge).
2. Skim `memory/` for dated notes newer than your last session.
3. If running **on Trung's machine** (paths under `/home/trkenng/...` exist), also read the OpenClaw companion files listed below. Merge any newer OpenClaw facts into this repo's `MEMORY.md` / `memory/` before coding.
4. If running **in Cursor Cloud**, those OpenClaw paths will not exist. Do not stall. Work from this repo knowledge base.
5. Treat the GitHub repo as the only place to edit plugin source. Do not patch a vault plugin copy and call that done.

## OpenClaw companion (local, not in git)

These files live on Trung's computer and may grow independently:

| Role | Path |
| --- | --- |
| Long-term OpenClaw memory | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/MEMORY.md` |
| OpenClaw agent instructions | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/AGENTS.md` |
| OpenClaw tools | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/TOOLS.md` |
| OpenClaw topic memory | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/memory/` |

Local plugin runtime copy (do not treat as source of truth):

`/home/trkenng/Obsidian-gifts/Obsidian-Vault Test-plugins/Obsidian-Vault Test-plugins/.obsidian/plugins/ikendoit-graph-stuff`

Harmonization protocol: `memory/openclaw-harmonization.md`.

## Working agreement

- Owner: Trung (`ikendoit`). Student; prefers working directly in code.
- Plugin id / GitHub: `ikendoit/ikendoit-graph-stuff`.
- Current version: `1.0.12`.
- Preferred delivery: GitHub release + **BRAT** on every device.
- Keep `main.js` committed. BRAT installs from GitHub repo/release contents.
- Keep runtime files at repo root: `main.js`, `manifest.json`, `styles.css`, `versions.json`.
- Do not commit secrets, tokens, or personal vault notes.
- Prefer small, testable UI changes over rewriting `main.ts` in one shot. `main.ts` is large (~3000 lines) and still holds both graph and map UI.

## Current product shape

Two live modes in one split-leaf view:

- **Graph mode**: D3 force graph of notes, avatars, search, hold-to-reveal node toolbelt.
- **Map mode**: Leaflet world map of pins stored in notes, address search, draft pin, save back into markdown.

The node **toolbelt** (hold a node ~3.6s, or tap it) is the intended per-node command surface: expand/collapse, **link two notes**, **create a neighbor note**, save layout, open note, switch to map.

## Do / don't

Do:

- Build in this repo (`npm run build`) before asking anyone to test in Obsidian.
- After a user-facing change, bump version only when preparing a BRAT release, then tag to match `manifest.json`.
- Persist graph coordinates and map pins **in the note markdown**, not in plugin `data.json`.
- Keep mobile in mind. This plugin is `isDesktopOnly: false`.
- When you learn a durable fact, write it into `MEMORY.md` or `memory/YYYY-MM-DD-*.md`.

Don't:

- Edit the vault plugin folder as the primary workflow.
- Remove committed `main.js`.
- Assume the CSS node-detail panel is live. `DisplayPanel.renderSelectedNodePanel()` currently tears the panel down; live UX is the control bar, toolbelt, and map sidebar.
- Invent a new install story that replaces BRAT. The vault sync bundle is a recovery path only.

## Primary files

| File | Why it matters |
| --- | --- |
| `main.ts` | Plugin entry, markdown parse, graph UI, map UI, toolbelt, persistence |
| `utils/graph_state.ts` | Visibility, search, expand/collapse, path-to-hit |
| `utils/canvas_panel_display.ts` | Stubbed/side panel API; CSS still exists for a richer inspector |
| `utils/constants.ts` | Node sizes, default avatar |
| `styles.css` | Graph, toolbelt, map, leftover node-panel styles |
| `manifest.json` | Plugin id + version BRAT/Obsidian read |
| `.github/workflows/release.yml` | Tag → GitHub release assets for BRAT |

## Next product focus

See `memory/node-toolbox.md`. Short version: turn the node toolbelt from “show/unshow neighbors” into a real per-node toolbox, without losing the hold-to-reveal mobile gesture.
