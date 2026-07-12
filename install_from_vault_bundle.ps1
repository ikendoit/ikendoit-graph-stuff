$ErrorActionPreference = "Stop"

$PluginId = "ikendoit-graph-stuff"
$BundleDir = if ($env:IKG_SYNC_BUNDLE_DIR) { $env:IKG_SYNC_BUNDLE_DIR } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ReleaseJson = Join-Path $BundleDir "release.json"

if (-not (Test-Path $ReleaseJson)) {
    Write-Error "Could not find $ReleaseJson. Run this script from the synced plugin bundle folder, or set IKG_SYNC_BUNDLE_DIR."
}

function Find-RemoteVault {
    if ($env:IKG_REMOTE_VAULT -and (Test-Path (Join-Path $env:IKG_REMOTE_VAULT ".obsidian"))) {
        return $env:IKG_REMOTE_VAULT
    }

    $searchRoots = @(
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE",
        "C:\Users"
    )

    foreach ($root in $searchRoots) {
        if (-not (Test-Path $root)) {
            continue
        }

        $match = Get-ChildItem -Path $root -Directory -Recurse -Depth 5 -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "Remote-Vault" -and (Test-Path (Join-Path $_.FullName ".obsidian")) } |
            Select-Object -First 1

        if ($match) {
            return $match.FullName
        }
    }

    return $null
}

$remoteVault = Find-RemoteVault
if (-not $remoteVault) {
    Write-Error "Could not find a Remote-Vault with an .obsidian folder. Set IKG_REMOTE_VAULT and retry."
}

$targetDir = Join-Path $remoteVault ".obsidian\plugins\$PluginId"
$communityPluginsJson = Join-Path $remoteVault ".obsidian\community-plugins.json"
$runtimeFiles = @("main.js", "manifest.json", "styles.css", "versions.json")

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
foreach ($file in $runtimeFiles) {
    Copy-Item -Force (Join-Path $BundleDir $file) (Join-Path $targetDir $file)
}

if (Test-Path $communityPluginsJson) {
    $plugins = Get-Content $communityPluginsJson -Raw | ConvertFrom-Json
    if ($PluginId -notin $plugins) {
        $plugins += $PluginId
        $plugins | ConvertTo-Json | Set-Content $communityPluginsJson
    }
} else {
    @($PluginId) | ConvertTo-Json | Set-Content $communityPluginsJson
}

Write-Host "Installed synced bundle into: $targetDir"
Write-Host "Restart Obsidian to load the updated plugin."
