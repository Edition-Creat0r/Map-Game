# Phase 3 — Lenovo hardware-test preparation

Graphics source: **8b5d6a99967b83a831cd3d640492d7d3b0746ee0**. Preparation branch: `phase3/lenovo-validation-prep`.

The accepted Phase 2 commit, nine approved IDs/footprints, GLB and 19 texture hashes are verified. This is a standalone static export, not a Git checkout. No original workspace, existing Lenovo folder, gameplay/economy/save/multiplayer/Supabase system, quarantined asset or other planned version was modified. No push or deployment occurred.

## Download and verify

[Download Map-Game-Lenovo-8b5d6a9.zip](evidence/lenovo-phase3/Map-Game-Lenovo-8b5d6a9.zip) (9,698,299 bytes; 58 files).

SHA-256:

```text
d6f755711ba9f7643523a8e2b8e1bf08f5591a5cf0d0c594175b21f13bc943b4
```

The ZIP contains only inventory-listed showroom assets, pinned local Babylon 9.32.0 distributions and licenses, a loopback-only static server, a hardware-oriented Chrome runner, package.json/lockfile, instructions and a results template. No cloud measurements, browser profiles, dependency cache, node_modules or old failed-test outputs are included. Gameplay/authentication/multiplayer entry points and the unused economy engine are omitted from the export. Original renderer/showroom scripts and approved asset bytes remain unchanged. The static HTML adapter changes only local dependency URLs and removes the original-catalog option/legacy link.

The server accepts GET/HEAD only, serves an explicit file allowlist, and blocks external page connections/scripts/images through CSP. The runner additionally aborts external requests. The first npm install is the only required external package download; it uses the pinned integrity-checked Playwright Core package and does not download Chromium. Installed Google Chrome is used afterward.

## Exact PowerShell commands

Use PowerShell 7 and Node.js 20+ (prefer current LTS). Save the supplied ZIP in Downloads. If your browser saves elsewhere, change only `$graphicsZip`. Start from any directory; do not enter an existing project checkout.

```powershell
$ErrorActionPreference = 'Stop'
$graphicsZip = Join-Path $HOME 'Downloads\Map-Game-Lenovo-8b5d6a9.zip'
if (-not (Test-Path -LiteralPath $graphicsZip -PathType Leaf)) { throw 'Downloaded ZIP not found; set $graphicsZip to its actual path.' }
$expectedZipSha256 = 'd6f755711ba9f7643523a8e2b8e1bf08f5591a5cf0d0c594175b21f13bc943b4'
if ((Get-FileHash -LiteralPath $graphicsZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedZipSha256) { throw 'ZIP checksum mismatch. Stop without extracting.' }
$testRoot = Join-Path $HOME ('Map-Game-Lenovo-P3-' + [guid]::NewGuid().ToString('N').Substring(0,12))
if (Test-Path -LiteralPath $testRoot) { throw 'Test destination already exists. Stop; do not overwrite it.' }
New-Item -ItemType Directory -Path $testRoot | Out-Null
Expand-Archive -LiteralPath $graphicsZip -DestinationPath $testRoot
Set-Location -LiteralPath $testRoot
Write-Host "New isolated test folder: $testRoot"
node --version
node -e "if (Number(process.versions.node.split('.')[0]) < 20) process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 20 or newer is required.' }
node .\verify.cjs
if ($LASTEXITCODE -ne 0) { throw 'Package verification failed.' }
npm ci --ignore-scripts --no-audit --no-fund --cache .\.npm-cache
if ($LASTEXITCODE -ne 0) { throw 'Pinned dependency installation failed.' }
$chromeExe = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $chromeExe) { throw 'Chrome not found. Set $chromeExe to your installed Google Chrome executable.' }
```

Before starting, open **chrome://settings/system** in regular Chrome, check “Use graphics acceleration when available”, and relaunch if prompted. Open **chrome://gpu**: record WebGL/WebGL2 Hardware accelerated status, GL/ANGLE renderer, GPU/driver and relevant Problems Detected text. Do not force unsafe browser flags. The actual test uses a separate fresh profile and records its own adapter/feature status; the regular-profile status alone does not establish test-process acceleration.

Connect AC power, record Windows power mode and display scaling, close GPU-heavy apps, and ensure a 1366×768 CSS-pixel test viewport can fit on screen. Keep the test Chrome visible and foreground. Do not resize, minimize, switch tabs, open DevTools or interact with the camera during measurement.

Continue in the **same new test folder**:

```powershell
$lenovoModel = Read-Host 'Lenovo model (no serial number needed)'
$gpuNote = Read-Host 'GPU/driver, AC power, Windows power mode and display scaling'
node .\run.cjs --chrome "$chromeExe" --lenovo "$lenovoModel" --gpu-note "$gpuNote"
if ($LASTEXITCODE -ne 0) { throw 'Run incomplete. Inspect the newest results folder and failure field; do not report it as a pass.' }
Get-ChildItem .\results -Directory | Sort-Object Name -Descending | Select-Object -First 1 FullName
```

The standard run takes approximately ten minutes plus loading/captures: 10/50/100/250 buildings, two runs per count, ten-second warm-up and 30-second static plus 30-second deterministic orbit segments; High cap/adaptive LOD, shadows OFF, viewport 1366×768 and DPR 1. It then captures all nine High designs with shadows ON, verifies nine true-overhead camera poses and rejects nine oblique poses. This protocol is longer than the cloud's short benchmarks; do not interpret it as the same sampling protocol or a renderer optimization A/B test.

The runner does not force SwiftShader or disable hardware acceleration in Windows mode. It rejects recognized software backends and records incomplete/failure status. Hardware eligibility is not automatic validation: review actual renderer, WebGL status, driver and visual evidence. **Do not use `--harness-test` on Lenovo**; that explicitly selects software/headless tool verification and marks reports ineligible for hardware validation.

## Results to return

Each invocation creates a unique `results\run-...` folder and a separate Chrome test profile inside it. Existing project folders and your ordinary Chrome profile are not selected. The runner starts/stops its own ephemeral loopback server. Results contain raw frame intervals, FPS, p95, draw/triangle/mesh counts, geometry and decoded-texture estimates, optional Chrome JS heap, readiness times, actual renderer/driver metadata and 18 PNGs. Missing JS heap is reported as unavailable. None of these memory estimates is physical VRAM.

Return these files only:

- `results.json`, `results.csv` and `results.md` from the completed run.
- The filled [RESULTS-TEMPLATE.md](../../tools/lenovo-validation/RESULTS-TEMPLATE.md), also included in the ZIP.
- Relevant close-up/overhead PNGs and visual notes.
- Actual WebGL/WebGL2 acceleration status from Chrome.

Do not send the `chrome-profile` folder, account data, browser history or saves. The generated Markdown table contains these eight count/segment rows with medians across two runs. The template adds optional JS heap values from the CSV:

| Buildings | Segment | Runs | FPS | p95 ms | Draws | Geometry MiB estimate | Textures MiB estimate | JS heap if available |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 10 | Static | | | | | | | |
| 10 | Orbit | | | | | | | |
| 50 | Static | | | | | | | |
| 50 | Orbit | | | | | | | |
| 100 | Static | | | | | | | |
| 100 | Orbit | | | | | | | |
| 250 | Static | | | | | | | |
| 250 | Orbit | | | | | | | |

For manual inspection or separate capture/benchmark commands, use README.md inside the archive. No normal Lenovo folders need to be reset, cleaned, removed or used as worktrees. The benchmark's distant adaptive LODs do not establish 250 close-up High/Ultra assets or shadows-on city performance.

## Preparation validation and limits

- 15 existing focused Quaternius Node tests passed.
- Exported package verification passed: nine model IDs and all 20 artifact hashes (GLB + 19 maps).
- Server integration checks passed: directory routing, local-only CSP, denied gameplay/auth/multiplayer/economy/results URLs, POST rejected, all approved assets served with exact hashes.
- Cloud package smoke test completed all four counts and all 18 captures, including nine positive overhead and nine negative oblique checks; zero page errors, failed requests or warnings. It explicitly reports cloud harness verification and `hardwareValidationEligible: false`.
- ZIP round-trip extraction, package hashes and server integration checks passed again.
- Initial tool-smoke failures exposed directory-index routing and null CPU buffer handling. Both preparation-tool defects were corrected before the successful run. No renderer or model was changed to make testing pass.
- Windows PowerShell commands have been reviewed, not executed on a Lenovo. **Lenovo hardware performance is not yet validated.** Driver-specific behavior and hardware results remain to be supplied by the user.

[Machine-readable preparation evidence](evidence/lenovo-phase3-validation.json). The ZIP and raw cloud tool outputs are local artifacts, not published GitHub content. The tooling source is under `tools/lenovo-validation`; its exporter reads the fixed accepted Phase 2 commit with `git show` and refuses an existing destination. It requires the prepared, hash-pinned Babylon distribution/license cache; it never fetches quarantined assets.

No GitHub transfer branch has been pushed. The supplied ZIP avoids needing a GitHub transfer. Any later push requires explicit authorization of the exact branch and commit. Stop after Phase 3 preparation; no additional visual work is included.
