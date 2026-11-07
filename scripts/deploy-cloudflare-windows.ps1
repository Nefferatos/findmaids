<#
.SYNOPSIS
    Builds and deploys FindMaids to Cloudflare Workers from Windows.

.DESCRIPTION
    `npm run deploy:cf` cannot build on Windows: OpenNext creates symlinks, which
    Windows refuses unless the shell is elevated or Developer Mode is on. This
    script builds without admin rights by

      1. installing a Node preload shim that swaps fs.symlink* calls for
         junctions / hardlinks (neither needs a privilege),
      2. restoring `pg-cloudflare` into Next's standalone output, which Next does
         not trace because `pg` requires it lazily, and
      3. uploading the Worker with wrangler.

    The same steps run on Linux/CI (see .github/workflows/deploy.yml), so keep
    both paths in sync when the build changes.

.PARAMETER SkipNextBuild
    Reuse the existing .next output and only re-run the OpenNext bundling step.
    Useful when iterating on configuration; much faster than a full build.

.PARAMETER SkipDeploy
    Build only, do not upload.

.PARAMETER ResetDevCache
    Delete .next after a successful deploy. The production build leaves state
    that Turbopack's dev server reuses, which shows up as "/agencies 500" and
    "Node.js subprocess crashed while evaluating loaders [postcss]".

.PARAMETER IncludeDotEnv
    Build with the local .env in place. Do not use this for a real deployment:
    OpenNext copies .env values into .open-next/cloudflare/next-env.mjs and
    .open-next/server-functions/default/.env, so local development secrets end up
    inside the uploaded Worker (it will then try to reach 127.0.0.1:5433).
    Runtime configuration must come from wrangler vars and `wrangler secret put`.

.EXAMPLE
    npm run deploy:cf:win

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudflare-windows.ps1 -SkipNextBuild -ResetDevCache
#>
[CmdletBinding()]
param(
    [switch]$SkipNextBuild,
    [switch]$SkipDeploy,
    [switch]$ResetDevCache,
    [switch]$IncludeDotEnv
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'node is not on PATH. Install Node.js 20.19+ (see .nvmrc) and open a new terminal.'
}

$version = (& node --version).TrimStart('v')
if ([version]($version -split '-' | Select-Object -First 1) -lt [version]'20.19.0') {
    throw "Node.js $version is too old; this repository requires 20.19 or newer."
}

# Keep sub-process output readable in both shells.
$env:CI = '1'

$openNextCli = Join-Path $repoRoot 'node_modules\@opennextjs\cloudflare\dist\cli\index.js'
$wranglerCli = Join-Path $repoRoot 'node_modules\wrangler\bin\wrangler.js'
foreach ($cli in @($openNextCli, $wranglerCli)) {
    if (-not (Test-Path $cli)) { throw "Missing $cli. Run 'npm install' first." }
}

# --- 1. Symlink shim -------------------------------------------------------
# A relative symlink target is relative to the LINK's directory (not the CWD),
# and junctions require an absolute path. Getting this wrong creates junctions
# pointing at C:\node_modules\..., which fails the bundle step.
$shimPath = Join-Path $env:TEMP 'findmaids-symlink-shim.cjs'
$shim = @'
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const origSymlinkSync = fs.symlinkSync.bind(fs);

function resolveTarget(target, linkPath) {
  return path.isAbsolute(target) ? target : path.resolve(path.dirname(linkPath), target);
}

function shimSync(target, linkPath, type) {
  const abs = resolveTarget(String(target), String(linkPath));
  let isDir = false;
  try {
    isDir = fs.statSync(abs).isDirectory();
  } catch {
    isDir = type === "dir" || type === "junction";
  }
  if (isDir) return origSymlinkSync(abs, linkPath, "junction");
  try {
    fs.linkSync(abs, linkPath);
  } catch {
    fs.copyFileSync(abs, linkPath);
  }
}

fs.symlinkSync = shimSync;
fs.symlink = function (target, linkPath, type, cb) {
  if (typeof type === "function") { cb = type; type = undefined; }
  try {
    shimSync(target, linkPath, type);
    if (typeof cb === "function") process.nextTick(cb, null);
  } catch (error) {
    if (typeof cb === "function") process.nextTick(cb, error);
    else throw error;
  }
};

const shimAsync = async (target, linkPath, type) => shimSync(target, linkPath, type);
fs.promises.symlink = shimAsync;
if (fsp && fsp.symlink) fsp.symlink = shimAsync;
'@

Set-Content -Path $shimPath -Value $shim -Encoding utf8
$env:NODE_OPTIONS = "--require $(($shimPath -replace '\\', '/'))"
Write-Host "[deploy] symlink shim: $shimPath" -ForegroundColor DarkGray

# --- 2. Build --------------------------------------------------------------
# Next crops the optional `pg-cloudflare` package to dist/empty.js in the
# standalone output while its package.json still points at dist/index.js, so
# esbuild cannot resolve it. Restoring the real package makes the bundling step
# succeed; it has to happen after `next build` has written .next\standalone.
function Restore-PgCloudflare {
    $source = Join-Path $repoRoot 'node_modules\pg-cloudflare'
    $traced = Join-Path $repoRoot '.next\standalone\node_modules\pg-cloudflare'
    if (-not (Test-Path $source)) { return $false }
    if (-not (Test-Path (Join-Path $traced 'package.json'))) { return $false }
    if (Test-Path (Join-Path $traced 'dist\index.js')) { return $false }
    Copy-Item (Join-Path $source '*') -Destination $traced -Recurse -Force
    Write-Host "[deploy] restored pg-cloudflare into $traced" -ForegroundColor DarkGray
    return $true
}

if (-not $SkipNextBuild) {
    # Never build with the local .env: OpenNext bakes those values into
    # .open-next/cloudflare/next-env.mjs (and copies .env into the server
    # function), which would upload development secrets and point the Worker at
    # 127.0.0.1:5433. Runtime config belongs in wrangler vars + secrets.
    $envFile = Join-Path $repoRoot '.env'
    $envBackup = Join-Path $repoRoot '.env.deploybak'
    $movedEnv = $false
    if (-not $IncludeDotEnv -and (Test-Path $envFile)) {
        Move-Item -LiteralPath $envFile -Destination $envBackup -Force
        $movedEnv = $true
        Write-Host '[deploy] .env parked for the build (pass -IncludeDotEnv to keep it)' -ForegroundColor DarkGray
    }

    try {
        # NEXT_PUBLIC_* values are inlined into the client bundle at build time,
        # and .env is parked for this build, so mirror the wrangler vars into the
        # build environment (otherwise canonical URLs fall back to localhost).
        $siteUrl = (& node -e "const fs=require('fs');const raw=fs.readFileSync('wrangler.jsonc','utf8');const stripped=raw.split(/\r?\n/).filter(l=>!/^\s*\/\//.test(l)).join('\n');try{process.stdout.write(JSON.parse(stripped).vars?.NEXT_PUBLIC_SITE_URL||'')}catch(e){process.stdout.write('')}").Trim()
        if ($siteUrl) {
            $env:NEXT_PUBLIC_SITE_URL = $siteUrl
            $env:NEXTAUTH_URL = $siteUrl
            Write-Host "[deploy] NEXT_PUBLIC_SITE_URL=$siteUrl" -ForegroundColor DarkGray
        }

        Write-Host '[deploy] next build + OpenNext build (this takes several minutes)...' -ForegroundColor Cyan
        & node $openNextCli build
        $buildExit = $LASTEXITCODE
        if ($buildExit -ne 0) {
            # The trace gap above is the usual reason a full build stops during
            # bundling. Restore the package and retry just the bundling step.
            if (-not (Restore-PgCloudflare)) {
                throw "OpenNext build failed with exit code $buildExit."
            }
            Write-Host '[deploy] retrying the bundling step...' -ForegroundColor Cyan
            & node $openNextCli build --skipNextBuild
            if ($LASTEXITCODE -ne 0) { throw "OpenNext bundling failed with exit code $LASTEXITCODE." }
        }
    }
    finally {
        if ($movedEnv) {
            Move-Item -LiteralPath $envBackup -Destination $envFile -Force
            Write-Host '[deploy] .env restored' -ForegroundColor DarkGray
        }
    }
}
else {
    Restore-PgCloudflare | Out-Null
    Write-Host '[deploy] bundling only (-SkipNextBuild)...' -ForegroundColor Cyan
    & node $openNextCli build --skipNextBuild
    if ($LASTEXITCODE -ne 0) { throw "OpenNext bundling failed with exit code $LASTEXITCODE." }
}

# Fail loudly if local values leaked into the bundle.
$nextEnv = Join-Path $repoRoot '.open-next\cloudflare\next-env.mjs'
if (Test-Path $nextEnv) {
    $leak = Select-String -Path $nextEnv -Pattern '127\.0\.0\.1|localhost|\.test"|display-only' -AllMatches -ErrorAction SilentlyContinue
    if ($leak) {
        throw "Refusing to deploy: $nextEnv contains local development values. Rebuild without .env (see -IncludeDotEnv help)."
    }
}

if (-not (Test-Path (Join-Path $repoRoot '.open-next\worker.js'))) {
    throw 'Build produced no .open-next\worker.js.'
}

# --- 3. Deploy -------------------------------------------------------------
if (-not $SkipDeploy) {
    Write-Host '[deploy] uploading Worker...' -ForegroundColor Cyan
    & node $wranglerCli deploy
    if ($LASTEXITCODE -ne 0) { throw "wrangler deploy failed with exit code $LASTEXITCODE." }
}

if ($ResetDevCache) {
    Remove-Item -Recurse -Force (Join-Path $repoRoot '.next') -ErrorAction SilentlyContinue
    Write-Host '[deploy] removed .next so the dev server starts clean.' -ForegroundColor DarkGray
}

Write-Host '[deploy] done.' -ForegroundColor Green
