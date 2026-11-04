# Lenovo / PowerShell 7 handoff

No branch was pushed, merged or deployed. This is a local graphics review, not
multiplayer activation or a release-ready resource pack. Do not run any Supabase
commands. The original 0.4.1 RC branch and all 14 protected files are unchanged.

A downloadable **Git bundle** can carry the unpublished graphics commits without
changing existing branches. It contains the graphics branch's commits after
`49b7dca` (the inspected published main ancestor), including the validated
Modern Frontier/industrial gameplay predecessors and previous prototype. Keep the accompanying SHA-256 from
the task report. No ZIP, schema dump, SDK cache or private data is included.

Run these individually, inspecting each result before continuing:

1. Open the Map-Game repository folder:
   ```powershell
   Set-Location 'C:\path\to\Map-Game'
   ```
2. Check local work. Stop if anything is modified; do not reset or clean it:
   ```powershell
   git status --short
   ```
3. Check the required published ancestor exists:
   ```powershell
   git cat-file -e '49b7dcac7395c409b2343c42b6efd5924394cb86^{commit}'
   ```
   If missing, run `git fetch origin main` (read-only network fetch; no merge or
   working-tree change), then repeat this check. Stop if still missing. Do not
   reset a branch or substitute a multiplayer baseline.
4. Download the task's `mapgame-graphics-review.bundle` into Downloads. Check its
   SHA-256 against the exact value provided with that artifact:
   ```powershell
   Get-FileHash "$HOME\Downloads\mapgame-graphics-review.bundle" -Algorithm SHA256
   ```
5. Verify the bundle and its prerequisite:
   ```powershell
   git bundle verify "$HOME\Downloads\mapgame-graphics-review.bundle"
   ```
6. Import into a separate local review reference (no network write):
   ```powershell
   git fetch "$HOME\Downloads\mapgame-graphics-review.bundle" 'refs/heads/feature/0.4.1-graphics-prototype:refs/remotes/local-graphics/0.4.1'
   ```
7. Create a NEW local branch. If the name already exists, choose a new review
   name; do not force or overwrite it:
   ```powershell
   git switch -c review/graphics-resource-update refs/remotes/local-graphics/0.4.1
   ```
8. Verify the full HEAD matches the task's final commit:
   ```powershell
   git rev-parse HEAD
   ```
9. Inspect the report and paired screenshots:
   ```powershell
   Start-Process 'resource-icons\REPORT.md'
   ```
10. With Python installed, serve locally:
    ```powershell
    py -m http.server 8017 --bind 127.0.0.1
    ```
    Keep that window open. In a second PowerShell window:
    ```powershell
    Start-Process 'http://127.0.0.1:8017/graphics-prototype/'
    ```
    Also open the main game at `/` and screenshots at
    `/resource-icons/evidence/`. Normal startup needs access to the game's
    existing Babylon and Supabase library CDNs. Tests used explicitly verified
    cached libraries; Windows/CDN startup has not been certified. Never disable
    TLS checks to fix a loading problem. Basic remains active; 3D stays opt-in.

## Optional local deterministic checks

With Node.js and Git available, execute separately:

```powershell
$testFiles = Get-ChildItem tests -Filter '*.test.cjs' | ForEach-Object FullName
node --test $testFiles
py graphics-prototype/tools/test_pack.py
```

See README.md for the private, read-only PNG audit and its Pillow environment.
Existing Playwright scripts mostly use Linux Chromium paths; do not claim they
ran on Lenovo. Manual checks: resource values, inventory, research, shop preview,
Easy Craft open/close and construction navigation, save/reload, pan/zoom and
World Map return. No manual crafting button or client-side Central World spending
is enabled. Keep the missing PNGs unimported until their source/license and image
mapping have been reviewed.

If bundle download fails, keep the local commits intact and request an explicitly
authorized branch push or alternative transfer. There is no automatic upload.
