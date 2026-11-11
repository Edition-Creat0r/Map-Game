# Lenovo: isolated Quaternius hardware validation

This package tests the accepted graphics at commit **8b5d6a99967b83a831cd3d640492d7d3b0746ee0**. It contains nine approved designs, the unchanged GLB and all 19 approved texture files. The original renderer/showroom scripts are unchanged. A static export adapter uses local Babylon 9.32.0 files and removes the unused economy-engine script, original-catalog choice and legacy link. Read-only catalog definitions retain canonical IDs/footprints. No game entry, account client, multiplayer client, saves, quarantined pack or machinery import is included.

The loopback server serves only inventory-listed package files and sends a Content Security Policy blocking external scripts, images and connections. Automated tests also abort all external page requests. No Supabase access or deployment is needed.

## Prepare a brand-new folder

Download the ZIP and compare its SHA-256 with the release message before extracting. The accompanying LENOVO_PHASE3.md supplies exact extraction commands and checksum. Do not reuse an existing Lenovo project folder or Git worktree. The archive is self-contained; no GitHub push or existing repository is required.

Prerequisites: an installed Google Chrome and Node.js 20 or newer (prefer current Node LTS). PowerShell 7 is recommended. No Python, Blender, Docker, ChromeDriver or downloaded Playwright browser is needed. The pinned `playwright-core` dependency drives your installed Chrome. The first npm install needs registry.npmjs.org; model viewing/testing works offline afterward.

Run these commands **from the newly extracted folder**:

```powershell
$ErrorActionPreference = 'Stop'
node --version
node .\verify.cjs
if ($LASTEXITCODE -ne 0) { throw 'Package verification failed' }
npm ci --ignore-scripts --no-audit --no-fund --cache .\.npm-cache
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
$chromeExe = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $chromeExe) { throw 'Chrome not found. Set $chromeExe to your installed Google Chrome executable.' }
```

All supplied outputs, npm cache and dedicated Chrome profiles are stored inside this fresh test folder. No normal Chrome profile or existing project is selected.

## Verify hardware acceleration first

1. In your regular Chrome, open `chrome://settings/system`. Enable **Use graphics acceleration when available**, then use Relaunch if Chrome requests it. This is a user action; no script edits browser settings.
2. Open `chrome://gpu`. Under **Graphics Feature Status**, record WebGL and WebGL2 and whether they say **Hardware accelerated**. Copy the ANGLE/GL renderer, GPU model and driver version. Record any relevant Problems Detected text. Do not change chrome://flags or force GPU/software flags to make a result pass.
3. The runner starts an independent, fresh Chrome test profile with default hardware selection and records the actual renderer and GPU feature information from that process. A regular-profile chrome://gpu page alone does not prove the test process used that GPU.
4. The runner stops and labels results ineligible when its renderer says SwiftShader, llvmpipe, software, Microsoft Basic Render Driver or WARP. Review the saved diagnostics if it stops. A completed run remains pending review of its reported adapter and feature status; it is not an automatic claim of Lenovo validation.

## Run the hardware test

Connect AC power. Record Windows power mode, display resolution/scaling, Lenovo model, GPU and Chrome version. Close GPU-heavy apps and other showroom tabs. Keep the dedicated test Chrome window **visible, unminimized and in the foreground**. Do not open DevTools, move the camera, resize or switch tabs during measurements. The runner uses a 1366×768 CSS-pixel viewport at deviceScaleFactor 1; verify your display can accommodate it. If it cannot, stop and report that limitation before comparing results.

```powershell
$lenovoModel = Read-Host 'Lenovo model (no serial number needed)'
$gpuNote = Read-Host 'GPU and driver / AC power / Windows power mode / display scaling'
node .\run.cjs --chrome "$chromeExe" --lenovo "$lenovoModel" --gpu-note "$gpuNote"
```

Default protocol: 10, 50, 100 and 250 buildings; two runs per count; High cap/adaptive LOD; shadows OFF; 10-second warm-up followed by 30-second static and 30-second deterministic orbit segments. About ten minutes plus loading/captures. The runner measures the entire segment rather than the showroom footer's rolling window. A hidden-tab event invalidates the segment. It then tests all nine designs at close range with shadows ON, including the corrected genuine top-down camera assertions and an explicit oblique-pose rejection for each design. No unsafe or software-rendering flags are used in this Windows mode.

Each invocation creates a new `results\run-...` folder containing:

- `results.json`: raw frame intervals, renderer/driver metadata, metrics and camera assertions; incomplete runs say `completed: false` and include a failure.
- `results.csv`: per-count, per-run static/orbit measurements.
- `results.md`: standardized table with two-run medians.
- `captures\`: 18 actual close-up/overhead PNGs.
- `chrome-profile\`: dedicated test profile, not your normal browser profile.

The Node process starts and stops its own ephemeral loopback server. Close the browser only after the terminal reports the saved results path. A nonzero exit code or incomplete report must not be reported as a pass.

Optional commands:

```powershell
# Only the corrected camera tests and 18 PNGs:
node .\run.cjs --chrome "$chromeExe" --captures-only --lenovo "$lenovoModel" --gpu-note "$gpuNote"
# Only the standard benchmark:
node .\run.cjs --chrome "$chromeExe" --bench-only --lenovo "$lenovoModel" --gpu-note "$gpuNote"
# Short 32-interval smoke measurement, NOT the standard hardware protocol:
node .\run.cjs --chrome "$chromeExe" --quick --bench-only --lenovo "$lenovoModel" --gpu-note "$gpuNote"
```

Do not use `--harness-test` on Lenovo: it deliberately uses headless SwiftShader and marks reports ineligible for hardware validation. That switch exists solely to test this tool in the cloud.

## Manual inspection

```powershell
node .\serve.cjs 8025
```

Leave that terminal running. In another terminal, after navigating to the same new folder:

```powershell
Start-Process 'http://127.0.0.1:8025/graphics-prototype/quaternius-prototypes/'
```

If the port is occupied, stop the failed command and choose 8026; do not terminate another application's server. Inspect all nine factories at High and Ultra. Note flicker, LOD popping, missing maps, incorrect shadows, culling errors or freezes. Manual inspection is separate from the scripted benchmark. Ctrl+C stops this manual server. Do not remove or clean any existing folders.

## What to report back

Send `results.json`, `results.csv`, the filled RESULTS-TEMPLATE.md, and selected PNGs with visual issues. Supply actual Chrome WebGL/WebGL2 acceleration status. Geometry/decoded-texture values are estimates and exclude driver, shader and framebuffer allocations. Optional JS heap is Chrome-specific and may be unavailable. None is physical VRAM. Do not infer 250 close-up High assets from the distant adaptive-LOD fixture. Do not compare the 30-second hardware protocol directly with the cloud's short SwiftShader samples as an optimization A/B result.

No account data, credentials, browser history, ordinary Chrome profile or game saves are requested. No Git push, merge or deployment is part of this workflow.
