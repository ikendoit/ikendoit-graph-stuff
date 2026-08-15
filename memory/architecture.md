# Architecture notes

Snapshot from the 2026-08-15 Cursor review. Code can drift; prefer `main.ts` if this disagrees.

## Modules

### `InteractiveGraphPlugin` (`main.ts`)

Obsidian `Plugin` subclass.

- Registers commands and hotkey `Mod+Alt+G`.
- On load, tries `installSyncedPluginUpdate()` (vault bundle fallback).
- `displayInteractiveGraph`:
  - Requires an open markdown file + active leaf.
  - Reads every markdown file (mtime cache).
  - Splits the workspace horizontally (`createLeafBySplit`).
  - Builds `AppContainer` + `DisplayPanel`.

Parsing:

- Wikilinks → edges (`parseBacklinks`).
- Tags, `#ROOT_NODE`, first image, `Coordinate-Graph-Render`, IKG map comments.

### `AppContainer` (`main.ts`)

Not a Modal anymore (commented alternative). Owns:

- `GraphState`
- D3 svg + force simulation
- Leaflet map instance
- Control bar (search, Graph/Map tabs, diagnostics toggle)
- Node toolbox gesture state
- Markdown rewrite helpers

`currentMode: 'graph' | 'map'`. Switching tears down the other canvas (`clearGraphCanvas` / `destroyMapMode`).

### `GraphState` (`utils/graph_state.ts`)

Pure-ish visibility engine.

Visible set =

1. root ids + current selection
2. BFS path from the first root (anchor) to other roots and to search hits
3. neighbors of non-collapsed roots/selection

Manual expand (`manuallyExpandedNodeIds`) vs collapse (`collapsedNodeIds`) vs “actively expanded” (in the initial displayable set). Panel/toolbox expand uses **manual** expand; the +/– badge uses **active expansion**. Those two predicates are easy to mix up — read `canPanelExpand` vs `canNodeExpand` before changing collapse UX.

Search: AND of whitespace tokens against a flattened lowercase blob (id, path, tags, description, map pin fields).

### `DisplayPanel` (`utils/canvas_panel_display.ts`)

Started as the mobile-friendly inspector (markdown preview, expand/collapse, map pin list).

**Current behavior:** `renderSelectedNodePanel()` deletes `.ikg-node-panel` and nulls element refs. `update*` methods no-op if elements are missing. CSS in `styles.css` still describes a full panel.

Treat as **dormant inspector**, not dead code to delete. Restoring it is part of the toolbox/inspector direction.

## Persistence model

All durable user data is **in the markdown notes**:

- Graph x/y → `Coordinate-Graph-Render(fx/fy)` (regex currently only allows non-negative numbers).
- Map pins → managed HTML-comment block with JSON payload + human markdown links.

Implications:

- Vault sync = data sync. No separate plugin DB.
- Editing notes in Obsidian can fight the plugin if the user deletes the managed block.
- Negative coordinates would fail the current `extractFxFy` regex (`(\d+(\.\d+)?)`). Worth knowing if layout save looks “lost” on the left/top of the origin.

## Rendering budget

Thresholds on `AppContainer`:

- labels if `visibleNodeCount <= 120` (always for selected/root/search)
- images if `<= 90`
- box decorations if `<= 50`

Simulation: stronger decay and weaker charge when `> 40` nodes; auto-stop after 1.2s or 2.2s.

## Map geocoding

- Primary: `https://nominatim.openstreetmap.org/search` (no custom User-Agent beyond fetch defaults — be gentle, debounce already exists on graph search but address search is explicit-submit).
- Fallback: `https://api.zippopotam.us/{us|ca}/{postal}`.

Saved URLs are normalized to `https://www.google.com/maps?q=lat,lng` when coords parse. Bare Google URLs without parseable coords can still store `url` with null lat/lng (those will **not** appear as map markers).

## Delivery

See `TOOLS.md`. Source → `npm run build` → committed `main.js` → git tag → GitHub Release → BRAT.

## Known leftover experiments

- `box_encapsulations` empty global; drag-box code still in the renderer.
- Split-leaf vs Modal comments throughout `onOpen` / `displayInteractiveGraph`.
- `renderMarkdownFileToHtml` does not actually render markdown (commented `MarkdownRenderer` call).
- `nodeOnclickHandler` looks like an older path; live clicks go through `handleNodePrimaryTap`.
