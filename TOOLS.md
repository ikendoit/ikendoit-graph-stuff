# TOOLS.md — ikendoit-graph-stuff

Commands, install paths, and release mechanics for Cursor agents.

OpenClaw companion (local only): `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/TOOLS.md`

## Repo commands

From the git repo root (this workspace):

```bash
npm install
npm run dev          # esbuild watch → main.js
npm run build        # tsc -noEmit + production esbuild
npm run version      # bump manifest.json + versions.json from package.json
```

Local vault helper (only useful on a machine that has the vault):

```bash
npm run sync-to-mobile-app          # bash copy_to_remote_vault.sh
npm run install-from-sync-bundle    # bash install_from_vault_bundle.sh
```

`copy_to_remote_vault.sh` looks for a vault named `Remote-Vault` or `$IKG_REMOTE_VAULT`. Trung's mentioned test vault is different:

`/home/trkenng/Obsidian-gifts/Obsidian-Vault Test-plugins/Obsidian-Vault Test-plugins`

If using that vault, set `IKG_REMOTE_VAULT` to that path before syncing. Never treat the copied plugin folder as source.

## Runtime files BRAT / Obsidian need

At repo root, committed:

- `main.js` (bundled)
- `manifest.json`
- `styles.css`
- `versions.json`

Source:

- `main.ts`
- `utils/*.ts`
- `styles.css`

`data.json` is gitignored (Obsidian plugin settings). This plugin currently persists knowledge **in notes**, not in `data.json`.

## BRAT (how Trung loads the latest version)

BRAT = Beta Reviewers Auto-update Tester (`TfTHacker/obsidian42-brat`).

On each device:

1. Community plugins → install and enable BRAT.
2. Command `BRAT: Add a beta plugin for testing`.
3. Repo path: `ikendoit/ikendoit-graph-stuff`.
4. Enable `ikendoit-graph-stuff` in Community plugins if needed.
5. After we publish a GitHub release, command `BRAT: Check for updates` (or BRAT's update list).

BRAT watches GitHub. A **git push to `main` is not enough** for a clean BRAT update. Ship a **GitHub Release** whose tag matches `manifest.json` `version` (with or without a `v` prefix; the workflow strips a leading `v`).

Release assets the workflow uploads:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

## How to cut a BRAT-visible release

1. Land code on the working branch / `main`.
2. Bump `package.json` version.
3. `npm run version` (syncs `manifest.json` + `versions.json`) then `npm run build`.
4. Commit `package.json`, `manifest.json`, `versions.json`, `main.js`, and source.
5. Push.
6. Tag the same version (`git tag 1.0.9 && git push origin 1.0.9`).
7. Confirm Actions `Release` succeeded.
8. Tell Trung to BRAT-check-for-updates on each device.

Do not tag a version that does not match `manifest.json`. The workflow fails closed.

Existing tags: `1.0.3` … `1.0.8`.

## CI

- `.github/workflows/build.yml` — `npm ci && npm run build` on `main`, `dev`, and PRs.
- `.github/workflows/release.yml` — tag push → verify version → GitHub release.

Node 22 in CI. Local agents should use a current Node as well.

## Vault sync bundle (fallback)

Published into the vault as:

`_ikg-plugin-sync/ikendoit-graph-stuff/`

Contains runtime files plus `release.json`:

```json
{
  "pluginId": "ikendoit-graph-stuff",
  "version": "1.0.8",
  "builtAt": "...",
  "files": ["main.js", "manifest.json", "styles.css", "versions.json"]
}
```

On plugin load, `installSyncedPluginUpdate()` copies those files into `.obsidian/plugins/ikendoit-graph-stuff` if the bundle version is newer. User must restart Obsidian after that Notice.

This exists because mobile/desktop vault sync can carry files even when GitHub/BRAT is awkward. It is **not** the primary publish path.

## Manual test checklist (after UI changes)

Graph:

1. Open a markdown note.
2. Command `Open interactive knowledge graph` (or `Mod+Alt+G`).
3. Current note should center; hold a node until the ring completes; bubbles appear.
4. Expand / collapse neighbors; search a title; Focus hit.
5. Drag a node; Save bubble; confirm `Coordinate-Graph-Render(` in the note.

Map:

1. Switch to Map mode.
2. Search an address; tap a result; red draft pin moves.
3. Save position; confirm the `IKG_MAP_POSITIONS` block in the note.
4. On a narrow viewport, utility cards should collapse/expand without eating map drags.

Install:

1. `npm run build` succeeds.
2. For a release: tag matches manifest; BRAT can see the new version.

## Paths agents may see

| What | Where |
| --- | --- |
| This git repo (source of truth) | Cursor workspace / `github.com/ikendoit/ikendoit-graph-stuff` |
| OpenClaw knowledge | `/home/trkenng/.openclaw/workspace-project-obsidian-ikengraph-plugin/` |
| Local test plugin copy | `/home/trkenng/Obsidian-gifts/Obsidian-Vault Test-plugins/Obsidian-Vault Test-plugins/.obsidian/plugins/ikendoit-graph-stuff` |

If a path is missing, you are probably in Cursor Cloud. Use this repo only.
