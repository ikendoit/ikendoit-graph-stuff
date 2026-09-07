# 2026-09-07 — Link two notes and create a neighbor

## What landed

Node toolbox verbs for registering people/places quickly:

1. **Link** — from a node’s bubbles, tap another node, write “Ada is a friend of Sam”, save.
2. **New note** — type a name, same sentence chips, plugin creates the markdown file and the graph neighbor.

Both notes get the same annotation in a managed block, with `[[wikilink]]` so `parseBacklinks` draws the edge.

```markdown
<!-- IKG_RELATIONSHIPS_START -->
## Linked notes

- [[Sam]] — Ada is a friend of Sam <!-- IKG_RELATIONSHIP {...} -->
<!-- IKG_RELATIONSHIPS_END -->
```

New files are created next to the source note, seeded with a graph coordinate, then the toolbox stays on the new node so the existing drag → Save → Map → Loop note → add image → reopen graph path still works.

If the typed name already exists, Save links instead of overwriting.

## UX notes

- Pick mode uses a banner, not a modal, so avatars stay visible.
- Empty-canvas taps do not cancel pick (easy miss on a phone). Cancel / Escape does.
- Chips fill the sentence until the user edits it.
