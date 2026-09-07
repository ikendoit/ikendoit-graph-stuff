# MEMORY.md — ikendoit-graph-stuff (Cursor harness)

Durable project memory for Cursor agents. Update this file when something important becomes true and should survive a new chat.

Companion OpenClaw memory (Trung's machine only):

`/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/MEMORY.md`

If both exist, newer dated notes win. Copy durable facts into **this** file so cloud agents can keep working.

## Identity

- Plugin name / id: `ikendoit-graph-stuff`
- Author: Trung / `ikendoit`
- GitHub: https://github.com/ikendoit/ikendoit-graph-stuff
- Version at last review: **1.0.12** (2026-09-07)
- Not in the official Obsidian community plugin store. Devices install it with **BRAT**.
- License: MIT

## What Trung wants this to be

A personal knowledge explorer for notes that feels like a living graph **and** a map:

- Open from the current note (`Mod+Alt+G`).
- See people/places/ideas as avatar nodes.
- Expand a neighborhood without drowning in the whole vault.
- Pin real-world locations onto notes and browse them on a map.
- Use it on desktop **and** phone.

The long-term flavor is playful and tactile (hold a node, bubbles appear, save a pin, jump to the note). It is not trying to clone Obsidian's built-in graph.

## How people install it (BRAT)

Preferred path on every device (desktop, laptop, mobile):

1. Install community plugin **BRAT** (TfTHacker/obsidian42-brat).
2. BRAT → Add a beta plugin: `ikendoit/ikendoit-graph-stuff`.
3. After a GitHub **release** whose tag matches `manifest.json` version, use BRAT “check for updates”.

Why BRAT: this plugin is not marketplace-listed. BRAT pulls `manifest.json`, `main.js`, `styles.css` from GitHub releases (and can also follow the repo). That is why `main.js` is committed and why `.github/workflows/release.yml` publishes those four files on tag push.

Secondary recovery path (not the happy path):

- `npm run sync-to-mobile-app` copies a built runtime into a local vault plugin folder and also writes `_ikg-plugin-sync/ikendoit-graph-stuff/`.
- Command `Apply synced plugin release from vault` can copy that bundle into `.obsidian/plugins/ikendoit-graph-stuff`.
- Bootstrap scripts: `install_from_vault_bundle.sh` / `.ps1`.

Local vault copy Trung mentioned (runtime only):

`/home/trkenng/Obsidian-gifts/Obsidian-Vault Test-plugins/Obsidian-Vault Test-plugins/.obsidian/plugins/ikendoit-graph-stuff`

## What already works (review snapshot, 2026-08-15)

### Graph

- Parses all vault markdown files.
- Nodes from note filenames (strips `.md` and `buddy-loop-exports/`).
- Links from wikilinks `[[Note]]` and optional z-index form `[[Note], 3]`.
- Skips media wikilinks (png/jpeg/jpg/webp) so images are not graph nodes.
- `#ROOT_NODE` in a note marks it as a root that stays in the visible set.
- First `![[image]]` in a note becomes the node avatar (base64).
- Persisted layout: `Coordinate-Graph-Render(x/y)` written into the note.
- Visibility model in `GraphState`: start from roots + current note, show neighbors, show path to search hits, expand/collapse branches.
- Search over title, path, tags (`#TAG` uppercase-ish), note text, and map pin labels/coords.
- Hold a node ~3.6s (progress ring) to lock the toolbelt; tap the same node again within 3.6s expands neighbors.
- Force simulation auto-stops; labels/images degrade when many nodes are visible.
- Desktop click can open the note in an existing markdown leaf; mobile avoids that auto-open.

### Map

- Second mode in the same view (Graph mode / Map mode tabs).
- Leaflet map, OSM streets plus Topo, Voyager, Satellite, Hybrid.
- Pins stored in a managed markdown block:

```markdown
<!-- IKG_MAP_POSITIONS_START -->
## Saved map positions
- [📍 Label](https://www.google.com/maps?q=lat,lng) <!-- IKG_MAP_POSITION {...json...} -->
<!-- IKG_MAP_POSITIONS_END -->
```

- Click map → red draft pin → Save position onto the selected node.
- Address search via Nominatim, with Zippopotam US/CA postal fallback.
- Mobile: collapsible utility cards, gesture shield so map pan does not fight Obsidian.

### Delivery

- `npm run build` typechecks + esbuild production bundle into `main.js`.
- Tag `1.0.8` (and earlier 1.0.3–1.0.7) already released.
- GitHub Actions: `build.yml` on push/PR, `release.yml` on tags.

## Honest gaps (do not paper over these)

- **Node toolbelt is still a thin action ring.** Bubbles exist (expand/collapse, collapse others, save layout, open note, map), but the product intent is a real node toolbox, not just show/unshow. See `memory/node-toolbox.md`.
- **Node detail side panel is not actually rendered.** `utils/canvas_panel_display.ts` `renderSelectedNodePanel()` removes `.ikg-node-panel` nodes. CSS for the panel is still in `styles.css`. Control-plane code still *talks* to `DisplayPanel` (title, subtitle, map list, markdown preview) against elements that are never built.
- `main.ts` is a monolith (~3000 lines) with leftover bookmarks, dual config comments (split leaf vs modal), and `any` types.
- Relationship **sentences** now persist in notes (`IKG_RELATIONSHIPS` block). SVG still draws an unlabeled edge.
- Link click handler is still TODO.
- `box_encapsulations` grouping rectangles exist in the renderer but the dataset is an empty module-level array.
- `DisplayPanel` expand/collapse/save buttons are never constructed, so panel handlers are currently dead.
- Search “path highlight” is visibility (show path nodes), not a dedicated highlighted trail UI.
- OpenClaw knowledge files are **not** in this git repo. Cloud agents must use this `MEMORY.md`.

## Note syntax the plugin understands

| In the note | Effect |
| --- | --- |
| `[[Other Note]]` | Graph edge |
| `[[Other Note], 2]` | Graph edge with zIndex |
| `#ROOT_NODE` | Always treated as a root |
| `#SOME_TAG` | Searchable tag (regex `#[A-Z0-9_-]+`) |
| `![[photo.png]]` | First embed becomes avatar |
| `Coordinate-Graph-Render(12.3/45.6)` | Pinned graph x/y |
| `<!-- IKG_MAP_POSITIONS_START -->` … `END` | Managed map pin block |
| `<!-- IKG_RELATIONSHIPS_START -->` … `END` | Managed bidirectional links + annotation sentences |

## Commands registered

- `Open interactive knowledge graph` — `Mod+Alt+G`
- `Open interactive knowledge graph from current note`
- `Open interactive knowledge graph and focus search`
- `Apply synced plugin release from vault`

Must have a markdown note open; otherwise a Notice asks the user to open one.

## Architecture map

```
InteractiveGraphPlugin (main.ts)
  parseMarkdownFile → nodes + links
  displayInteractiveGraph → split leaf + AppContainer

AppContainer (main.ts)
  GraphState visibility
  graph mode: D3 svg, toolbelt, simulation
  map mode: Leaflet + sidebar cards
  persistence: rewrite note markdown

DisplayPanel (utils/canvas_panel_display.ts)
  intended inspector; currently teardown-only

GraphState (utils/graph_state.ts)
  adjacency, collapse/expand, search, path BFS
```

## Session log

### 2026-09-07 — Link + new neighbor toolbox verbs

- Toolbelt grew two people-first verbs: **Link** (pick another node, save one sentence onto both notes) and **New note** (create a neighbor file beside the source, then same annotation).
- Persistence matches map pins: append a managed markdown block with newlines, plus `[[wikilink]]` so the graph edge appears after refresh.
- After create, the new node is pinned near the source so the user can drag, Save layout, add a map pin, then Loop note for images.

### 2026-08-15 — Cursor onboarding / dual-agent knowledge base

- Reviewed public repo `ikendoit/ikendoit-graph-stuff` at `1.0.8`.
- Could not read OpenClaw files from Cursor Cloud (`/home/trkenng/.openclaw/...` is not on this machine).
- Established repo-local agent knowledge: `AGENTS.md`, `MEMORY.md`, `TOOLS.md`, `memory/`, `.cursor/rules/ikengraph.mdc`.
- Confirmed BRAT + GitHub releases is the intended cross-device load path.
- Recorded node-toolbox as the main forward direction.

When a later agent reads OpenClaw `MEMORY.md` on Trung's machine, merge any extra history into this file rather than leaving it only in OpenClaw.
