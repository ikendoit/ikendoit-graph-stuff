#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ID="ikendoit-graph-stuff"
SYNC_BUNDLE_DIR="${IKG_SYNC_BUNDLE_DIR:-$SCRIPT_DIR}"
RELEASE_JSON="$SYNC_BUNDLE_DIR/release.json"

if [[ ! -f "$RELEASE_JSON" ]]; then
  echo "Could not find $RELEASE_JSON"
  echo "Run this script from the synced plugin bundle folder, or set IKG_SYNC_BUNDLE_DIR."
  exit 1
fi

find_remote_vault() {
  if [[ -n "${IKG_REMOTE_VAULT:-}" && -d "${IKG_REMOTE_VAULT}/.obsidian" ]]; then
    printf '%s\n' "$IKG_REMOTE_VAULT"
    return 0
  fi

  local search_roots=(
    "/mnt/c/Users"
    "$HOME"
    "$HOME/Documents"
    "$HOME/Obsidian-gifts"
  )

  local root
  local match
  for root in "${search_roots[@]}"; do
    [[ -d "$root" ]] || continue
    match="$(find "$root" -maxdepth 6 -type d -path "*/Remote-Vault/.obsidian" 2>/dev/null | head -n 1 || true)"
    if [[ -n "$match" ]]; then
      dirname "$match"
      return 0
    fi
  done

  return 1
}

REMOTE_VAULT="$(find_remote_vault || true)"
if [[ -z "$REMOTE_VAULT" ]]; then
  echo "Could not find a Remote-Vault with an .obsidian folder."
  echo "Set IKG_REMOTE_VAULT to the correct vault path and retry."
  exit 1
fi

TARGET_DIR="$REMOTE_VAULT/.obsidian/plugins/$PLUGIN_ID"
COMMUNITY_PLUGINS_JSON="$REMOTE_VAULT/.obsidian/community-plugins.json"
RUNTIME_FILES=(main.js manifest.json styles.css versions.json)

mkdir -p "$TARGET_DIR"
for file in "${RUNTIME_FILES[@]}"; do
  cp "$SYNC_BUNDLE_DIR/$file" "$TARGET_DIR/$file"
done

if [[ -f "$COMMUNITY_PLUGINS_JSON" ]]; then
  if ! grep -q '"'$PLUGIN_ID'"' "$COMMUNITY_PLUGINS_JSON"; then
    node - <<'NODE' "$COMMUNITY_PLUGINS_JSON" "$PLUGIN_ID"
const fs = require('fs');
const [jsonPath, pluginId] = process.argv.slice(2);
const plugins = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (!plugins.includes(pluginId)) {
  plugins.push(pluginId);
}
fs.writeFileSync(jsonPath, `${JSON.stringify(plugins, null, 2)}\n`);
NODE
  fi
else
  printf '[\n  "%s"\n]\n' "$PLUGIN_ID" > "$COMMUNITY_PLUGINS_JSON"
fi

echo "Installed synced bundle into: $TARGET_DIR"
echo "Restart Obsidian to load the updated plugin."
