# 2026-08-15 — Cursor onboarding handoff

```text
Handoff 2026-08-15
Agent: Cursor (Cloud)
Code: branch cursor/agent-knowledge-base-e6fe (docs only; plugin still 1.0.8 / 5fd2ebe)
Shipped to BRAT?: no (no plugin behavior change)
Memory updated: AGENTS.md, MEMORY.md, TOOLS.md, memory/*, .cursor/rules/ikengraph.mdc
OpenClaw sync needed?: yes — OpenClaw files were not reachable from Cursor Cloud.
  Please copy a short pointer from repo AGENTS.md / MEMORY.md into
  /home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/
  so the OpenClaw friend knows the Cursor knowledge base now lives in git.
Next focus: grow the node toolbox beyond show/unshow; optionally restore DisplayPanel inspector.
```

## Review highlights for the next coding session

- Plugin is real and feature-rich for v1.0.8: graph + map + BRAT releases + mobile map work from July 2026.
- Biggest product gap Trung named: node toolbox.
- Biggest code smell: dormant `DisplayPanel` vs live toolbelt/control bar/map sidebar.
- Do not start by rewriting `main.ts`. Add toolbox verbs first.

## OpenClaw files status this session

Attempted and missing in Cloud:

- `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/MEMORY.md`
- `AGENTS.md`, `TOOLS.md`, `memory/`

Those remain the local intimate knowledge store. This repo now has a portable twin.
