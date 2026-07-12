#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLUGIN_ID="ikendoit-graph-stuff"
RUNTIME_FILES=(main.js manifest.json styles.css package.json versions.json)
SYNC_BUNDLE_FILES=(main.js manifest.json styles.css versions.json install_from_vault_bundle.sh install_from_vault_bundle.ps1 INSTALL_SYNCED_RELEASE.md)
SYNC_BUNDLE_ROOT="${IKG_SYNC_BUNDLE_ROOT:-_ikg-plugin-sync}"

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
SYNC_BUNDLE_DIR="$REMOTE_VAULT/$SYNC_BUNDLE_ROOT/$PLUGIN_ID"
COMMUNITY_PLUGINS_JSON="$REMOTE_VAULT/.obsidian/community-plugins.json"

echo "building.."
npm run build

echo "deploying local runtime copy.."
mkdir -p "$TARGET_DIR"
cp "${RUNTIME_FILES[@]}" "$TARGET_DIR/"

echo "publishing synced release bundle.."
mkdir -p "$SYNC_BUNDLE_DIR"
cp "${SYNC_BUNDLE_FILES[@]}" "$SYNC_BUNDLE_DIR/"

node - <<'NODE' "$SCRIPT_DIR/manifest.json" "$SYNC_BUNDLE_DIR/release.json"
const fs = require('fs');
const [manifestPath, releasePath] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const release = {
  pluginId: manifest.id,
  version: manifest.version,
  builtAt: new Date().toISOString(),
  files: ['main.js', 'manifest.json', 'styles.css', 'versions.json']
};
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
NODE

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

echo "Deployed to: $TARGET_DIR"
echo "Synced bundle published to: $SYNC_BUNDLE_DIR"
echo "Done"
