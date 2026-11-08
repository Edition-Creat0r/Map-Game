# Lenovo review — Windows PowerShell 7

This is an isolated graphics showroom. It does not activate the models in gameplay, unlock buildings, alter saves or connect to Supabase. **Lenovo performance has not been validated by Codex.** The automated results use Linux Chromium SwiftShader.

## 1. Obtain the local checkpoint safely

The feature branch has **not been pushed**. A normal GitHub pull cannot retrieve this update yet. Transfer the prepared incremental `mapgame-quaternius-phase2.bundle` through the available artifact/file-download mechanism. It requires parent commit `5b51d3e07b1779e964040179ac797234fef77d25` in your local repository. The file's exact SHA-256 is supplied in the release report. Do not run a reset, clean, force-push, or overwrite your multiplayer/0.4.3 working tree.

From your existing repository, check the prerequisite:

```powershell
git cat-file -e '5b51d3e07b1779e964040179ac797234fef77d25^{commit}'
```

Set the downloaded bundle path (change the filename/location only if necessary):

```powershell
$graphicsBundle = "$HOME\Downloads\mapgame-quaternius-phase2.bundle"
```

Check its checksum against the report:

```powershell
Get-FileHash -Algorithm SHA256 $graphicsBundle
```

Verify the bundle before importing it:

```powershell
git bundle verify $graphicsBundle
```

Fetch into a separate local reference, without changing your current branch:

```powershell
git fetch $graphicsBundle 'refs/heads/feature/0.4.2-quaternius-replacements:refs/remotes/local-quaternius/phase2'
```

Create a detached test worktree. If that destination already exists, choose a new empty path; do not delete or overwrite your edits:

```powershell
git worktree add --detach "$HOME\Map-Game-Quaternius-Phase2" refs/remotes/local-quaternius/phase2
```

If bundle verification reports a missing prerequisite, stop. Obtain the prerequisite checkpoint through an approved transfer first. If the chat's file-download mechanism is unavailable, the bundle must be transferred by another approved method; no public upload or push was performed automatically.

## 2. Launch

```powershell
Set-Location "$HOME\Map-Game-Quaternius-Phase2"
```

```powershell
node --version
```

If Node.js is missing, install the official current Node.js LTS and reopen PowerShell. No Python, Blender, Docker or Supabase installation is needed to view the already-built models.

Start a local-only server:

```powershell
npx --yes http-server@14.1.1 . -a 127.0.0.1 -p 8025 -c-1
```

Leave that terminal running. Open this address in Chrome or Edge:

`http://127.0.0.1:8025/graphics-prototype/quaternius-prototypes/`

If the port is occupied, use `-p 8026` and change the URL accordingly. Babylon.js and its glTF loader require access to their configured CDN; a library-load error is not evidence of a model or economy failure. Do not disable TLS verification to fix a loading problem.

## 3. Presets and controls

- **Low:** cached plain façades, merged roofs, silhouette equipment.
- **Medium:** cached window façades with 3D equipment and AC units.
- **High:** detailed native Quaternius geometry, original industrial equipment and PBR maps at close range; adaptive distant LODs remain active.
- **Ultra:** the same detailed High assets, retained 50% farther before LOD transitions. It is not an extra asset pack, animation mode or fourth geometry LOD.

These are lab-only controls and do not write the game's visual preferences. Start at High with one model. Drag to orbit; wheel to zoom. Choose each of the nine studies. The footer updates **FPS and draw calls approximately once per second**. It may briefly read zero while the scene starts; wait for the Ready status and a few frames.

For optional real-time showroom shadows, append `?shadows=1`. For a scene of 250 factories at High, use:

`http://127.0.0.1:8025/graphics-prototype/quaternius-prototypes/?count=250&quality=high`

The original-three-only comparison is:

`http://127.0.0.1:8025/graphics-prototype/quaternius-prototypes/?count=250&quality=high&ids=steelMill,precisionElectronicsWorks,machineWorks`

## 4. Record actual hardware results

1. Close other game/showroom tabs and applications that heavily use the GPU.
2. Check `chrome://gpu` (or `edge://gpu`) for WebGL hardware acceleration. Do not force unsafe browser flags. The automated cloud benchmarks explicitly request software rendering; this manual procedure does not.
3. Test **10, 50, 100 and 250** buildings at High, then Low/Medium/Ultra as desired. Keep the same browser size, shadows option, camera reset and quality when comparing runs.
4. Wait at least 10 seconds for warm-up after each change. Observe FPS for at least 30 seconds while stationary, then while gently orbiting/zooming.
5. Open developer tools → Console and run:

```javascript
quaterniusShowroom.resetMetrics()
```

After your 30-second stationary/orbit segment:

```javascript
JSON.stringify(quaterniusShowroom.metrics(), null, 2)
```

Copy the resulting **graphics metrics only** into a text file. They contain browser renderer, viewport, camera, FPS/frame intervals, long tasks, draw/triangle/mesh counts and memory estimates. No account/JWT/credential or game save export is needed. Also record Lenovo model, GPU, browser/version, preset, count, shadows option and whether it was a stationary or orbit test. The texture/geometry values are estimates, not measured physical VRAM.

Inspect Machinery Works' three aligned loading doors, CNC enclosure, horizontal lathe and press. Check distinct tank/refinery, glass-rack/kiln, clean-fab, vehicle-line, loading-dock and battery-cell silhouettes. Report flicker, delayed edge entry, missing textures, console errors or sudden frame spikes.

## 5. Stop cleanly

Close the showroom and press **Ctrl+C** in the server terminal. Your original working trees, multiplayer database and game saves are unaffected. Remove only the detached test worktree later with `git worktree remove` when you no longer need it; do not use force deletion on a worktree with your own edits.
