# Dual-agent harmonization (Cursor ↔ OpenClaw)

Trung has two AI friends on this project:

1. **OpenClaw agent** — knowledge lives on the local machine, outside this git repo.
2. **Cursor agent** (this harness, including Cloud Agents) — knowledge lives **in this repo** so it survives new chats and remote VMs.

They should be able to work independently, then reconcile.

## Where each memory lives

| Store | Location | Visible to |
| --- | --- | --- |
| Cursor long-term | `MEMORY.md` in this repo | Every Cursor / Cloud agent |
| Cursor topic notes | `memory/` in this repo | Every Cursor / Cloud agent |
| Cursor operating manual | `AGENTS.md`, `TOOLS.md` | Every Cursor / Cloud agent |
| OpenClaw long-term | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/MEMORY.md` | Only processes on Trung's machine |
| OpenClaw notes | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/memory/` | Same |
| Plugin source | this GitHub repo | Both, via git |

Code always ships through **git**. Memory is allowed to be dual-homed.

## Independent work (Cursor Cloud)

If `/home/trkenng/.openclaw/...` does not exist:

- Do not block on it.
- Trust `AGENTS.md` + `MEMORY.md` + `memory/`.
- When you learn something durable, write it here so the next Cursor agent has it.
- Optionally mention in the PR/summary: “OpenClaw files were not reachable; please copy this note into OpenClaw MEMORY.md if you want both brains in sync.”

## Independent work (OpenClaw on the laptop)

If OpenClaw cannot see this GitHub checkout:

- Still treat GitHub `main` (or the active PR) as code truth.
- When OpenClaw learns something durable, Trung or a later Cursor session should copy it into this repo's `MEMORY.md`.

## Harmonize when both are reachable

On Trung's machine, at the start of a Cursor session:

1. Read OpenClaw `MEMORY.md` and newest `memory/*`.
2. Diff against this repo's `MEMORY.md`.
3. Merge facts (dates, decisions, “do not regress X”) into the **repo** files and commit.
4. If OpenClaw is missing a repo fact (BRAT tag process, toolbelt internals), append a short note to OpenClaw `MEMORY.md` so that agent stays current.

Do not try to make the two folder trees identical. Keep:

- **Repo** = portable, versioned, enough to code and release.
- **OpenClaw workspace** = intimate local diary, vault paths, personal notes, session color.

## Conflict rules

- For **plugin code**: git wins. Newest committed/pushed revision is truth.
- For **product intent**: Trung's latest spoken/written request wins.
- For **memory facts**: the note with the newest date wins; record the loser as superseded rather than deleting history silently.
- Never copy personal vault note content into git.

## Suggested ping format when handing off

```text
Handoff YYYY-MM-DD
Agent: Cursor | OpenClaw
Code: branch / SHA / PR
Shipped to BRAT?: yes/no (tag)
Memory updated: MEMORY.md, memory/....md
OpenClaw sync needed?: yes/no
Next focus: node toolbox / map / release / ...
```

Drop that block into `memory/YYYY-MM-DD-handoff.md` in this repo. If OpenClaw is available, paste a copy there too.
