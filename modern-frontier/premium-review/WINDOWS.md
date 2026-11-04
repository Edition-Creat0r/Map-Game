# Lenovo / PowerShell 7 — local premium UI review

No GitHub push, main merge, deployment or Supabase operation is needed. The local
bundle includes this graphics branch and its required gameplay predecessors.
Prerequisite: published main ancestor `49b7dcac7395c409b2343c42b6efd5924394cb86`.

Run each command separately. Replace the repository path in step 1.

```powershell
Set-Location 'C:\path\to\Map-Game'
```

Inspect current work; leave it untouched:

```powershell
git status --short
```

Download `mapgame-premium-ui.bundle` into Downloads; compare this hash with the
exact SHA-256 supplied in the task's final response:

```powershell
Get-FileHash "$HOME\Downloads\mapgame-premium-ui.bundle" -Algorithm SHA256
```

Verify the bundle and prerequisite. Stop on errors. If the prerequisite is absent,
`git fetch origin main` is a read-only fetch; verify again afterwards. Do not reset
or merge anything.

```powershell
git bundle verify "$HOME\Downloads\mapgame-premium-ui.bundle"
```

Import into a separate local reference:

```powershell
git fetch "$HOME\Downloads\mapgame-premium-ui.bundle" 'refs/heads/feature/0.4.1-graphics-prototype:refs/remotes/local-review/premium-ui'
```

Create a new review branch and folder, preserving your current branch and any
private/uncommitted files. If either name exists, choose a fresh name; never force:

```powershell
git worktree add -b review/premium-ui '..\Map-Game-premium-review' refs/remotes/local-review/premium-ui
```

```powershell
Set-Location '..\Map-Game-premium-review'
```

Verify the full commit matches the task's final SHA:

```powershell
git rev-parse HEAD
```

Serve locally on a separate port:

```powershell
py -m http.server 8019 --bind 127.0.0.1
```

Open an InPrivate/Incognito browser window at `http://127.0.0.1:8019/` to review
without opening existing browser saves. In Singleplayer, inspect Build, Goals and
Settings. Check tabs, favorites, Place/cancel, three pinned achievements and
save/reload. Screenshots: `/modern-frontier/premium-review/evidence/`.

Normal startup requires the existing library CDNs. Automated browser tests used
verified caches on Linux; they do not certify Lenovo hardware or live CDN access.
Do not disable TLS verification for loading problems. Regular 3D stays paused.
No resource pack, credentials or database deployment is required for this UI.

If download fails, keep the local commits intact; request a separately authorized
branch push or another transfer method. Nothing was uploaded automatically.
