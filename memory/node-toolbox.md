# Node toolbox — current state and intended direction

This is the main product growth area Trung called out.

In the UI it is the ring of emoji bubbles around a selected node (`ikg-node-toolbelt`). Code calls it a **toolbelt**; Trung also says **node-toolbox**. Same thing. Prefer “node toolbox” in user-facing copy later; keep `toolbelt` in class names unless we rename in one pass.

## How it works today

Reveal:

- **Hold** a node for `NODE_HOLD_REVEAL_MS` (3600 ms). A pink progress ring fills, then the toolbox locks onto that node and the graph rerenders with extra collision radius.
- **Tap** a node: selects it, moves the toolbox host, starts a 3.6s second-tap window.
- **Second tap** in that window: `markNodeManuallyExpanded` (show neighbors) if allowed.
- Click empty SVG canvas: hide toolbox (`activeNodeToolbeltId = null`).

Bubbles from `getNodeActionBubbles()` / `handleNodeActionBubble()`:

| key | emoji | What it actually does |
| --- | --- | --- |
| `expand-neighbors` / `collapse-branch` | ✨ / 🌙 | Show or hide that node's neighbor set |
| `collapse-others` | 🍂 | Collapse every other manually expanded node |
| `save-layout` | 💾 | Write `Coordinate-Graph-Render(x/y)` for **all visible** nodes |
| `show-markdown` | 📜 | Open the note in a markdown leaf (“Loop note”) |
| `new-neighbor` | 🌱 | Create a new note next to this one, write a bidirectional relationship, and drop the neighbor on the graph |
| `link-nodes` | 🔗 | Tap a second node, then save a short sentence onto both notes |
| `show-map` | 🗺️ | Switch the whole view to Map mode |

Collision: while the toolbox is open, that node's collide radius and incident link distance increase so bubbles are not buried.

The + / – badge on the node itself is a **status light**, not a separate control. Expand/collapse is meant to go through the toolbox or the second-tap shortcut.

## Why Trung said it “just show/unshow nodes”

Expand/collapse stays, and **Link** / **New note** now change the vault graph. Save / open note / map remain jumps. The intended identity is: **this node is an object; the bubbles are its verbs.**

Show/unshow should remain one verb, not the whole product.

## Direction (implement against this, unless Trung says otherwise)

Build an extensible per-node command surface.

Design constraints:

- Keep hold-to-reveal. It is the mobile-friendly gesture.
- Keep one toolbox per graph (not five open at once).
- Do not block the map mode; map already has its own selected-node card.
- Prefer adding actions in `getNodeActionBubbles` + `handleNodeActionBubble` first. If the ring gets crowded, group into a primary ring + “more” that opens a real inspector.

### Near-term verbs that fit the existing engine

1. **Pin as root / unpin** — `graphState.ensureNodeIsRoot` already exists; there is no unpin UI.
2. **Isolate this neighborhood** — collapse others is close; add “show only me + neighbors”.
3. **Save this node’s layout only** — today Save writes every visible node.
4. **Open note** — already there; rename from “Loop note” if we touch copy.
5. **Focus map pin / add map pin** — Map bubble currently switches mode; could also draft a pin if the node already has coordinates.
6. **Copy wikilink / copy title**
7. **Mark `#ROOT_NODE` in the file** (persist the root flag, not just session state)

### Shipped relationship verbs (2026-09-07)

- **Link** (`link-nodes`): pick another visible node, type or chip-fill “A is a friend of B”, append the same sentence plus `[[wikilink]]` to both notes in a managed `IKG_RELATIONSHIPS` block (same padding style as map pins).
- **New note** (`new-neighbor`): name the neighbor, same annotation chips, create `{folder}/{Name}.md` beside the source, write the relationship both ways, pin the new node near the source. Existing titles become a link instead of a second file.
- Escape / Cancel aborts. After save, the new or target node keeps the toolbox so the user can drag, Save layout, Map, or Loop note.

### Medium-term (matches TODOs in `main.ts`)

- Restore **node inspector** (`DisplayPanel` + `.ikg-node-panel` CSS). Toolbox “inspect” bubble should build the panel instead of the current teardown.
- **Richer relationship tools**: labeled edges in the SVG, z-index visibility, link click (still unimplemented).
- **Tag / filter from a node** — search is global; a bubble could set the search to that node's tags.
- Custom backlink label syntax (TODO in file header).

### Implementation notes for agents

- `AppContainer.activeNodeToolbeltId` is the host node.
- Rerender is coarse: many actions call `rerenderGraph()` which destroys and rebuilds the SVG. Fine for now; avoid making that worse with extra full rebuilds per animation frame.
- `GraphState` is the right place for visibility verbs. Persistence verbs belong next to `saveAndUpdateNodesFxFy` / `saveMapPositionForNode`.
- If adding many bubbles, extract `getNodeActionBubbles` into `utils/node_toolbox.ts` rather than growing `main.ts` further.
- `utils/canvas_panel_display.ts` still has handler hooks for expand/collapse/save/map. Either wire the panel back up or stop pretending it is live.

## Do not regress

- 3.6s hold ring and second-tap expand.
- Toolbox clearance so bubbles are clickable.
- Mobile pointer events (`pointerdown` / `pointerup` / `pointercancel`).
- Canvas click dismisses the toolbox.
