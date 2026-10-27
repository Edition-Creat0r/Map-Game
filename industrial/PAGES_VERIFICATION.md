# Required manual GitHub Pages verification

The environment's authorized GitHub API calls return `Forbidden`; the previous public-site check also received proxy `CONNECT 403`. Repository files alone do **not** identify the Pages source. No deployed website has been validated by this RC investigation.

1. Open https://github.com/Edition-Creat0r/Map-Game/settings/pages using an account with repository Settings access. Record whether Pages is enabled, its displayed site URL/custom domain, **Build and deployment → Source**, and the source branch/folder when “Deploy from a branch” is selected. Confirm whether it is `main` + `/ (root)`, another branch/folder, or GitHub Actions. Do not silently change these settings to make this gate pass.
2. If the source is GitHub Actions, inspect the actual deployment workflow and most recent Pages run under **Actions**. Confirm triggers, checked-out ref/commit and uploaded artifact path. If no repository workflow explains the configuration, resolve the missing/external workflow before merging. If the source is another branch/folder, document how the merged code reaches that publication source; do not assume a main merge deploys it.
3. Create the normal PR targeting `main` from the pushed feature branch using the supplied link/body. Verify its commit list includes rendering fixes, biomes, forests, terrain/hydrology, Singleplayer economy and Phases A/B/C1. Refresh main, resolve any new conflicts safely, and rerun final tests on the exact updated proposed merge tree if main or the PR has changed. Review diff/checks and all security/performance gates before merging. The currently permitted merge is conditional, not mandatory when a gate is unresolved.
4. After an authorized successful merge, wait for the actual Pages build/deployment to succeed. Record the PR URL, merge SHA, deployment/run URL, deployed commit SHA and the final Pages URL. Confirm the deployed artifact includes the merged C1 code, not merely an older successful deployment. A feature-branch push or a green local test is not deployment evidence.
5. Open the **actual URL displayed by Pages**, with ordinary TLS verification enabled, in a clean browser profile. Check Network/Console for HTTP failures, missing scripts/textures, uncaught errors and stuck loading. Verify Babylon.js and Supabase scripts load; do not create multiplayer resource transactions. Check the displayed C1 version and a new game's ten initial materials.
6. Test Singleplayer launch, World Map pan/navigation, local territory entry, shop construction and actual placement, one legitimate research unlock, exact resource consumption, save/reload, automatic/manual priority persistence, tree/terrain/water display and return to the World Map. Use a disposable profile; back up private existing saves before migration checks. Confirm a pre-C1 save preserves 121 internal stocks, legal factory contracts, unknown fields, claims and partial timing. No one should paste private saves or credentials into a public PR.
7. Record representative startup, pan/zoom frame intervals and any long tasks against the local validated baseline. Verify a repeat visit does not load stale cached pre-C1 scripts. Only then report deployed-site validation. If any step is blocked/fails, record it and leave the release gate uncleared.

Once authorized API access exists, useful read-only checks are:

```sh
gh api repos/Edition-Creat0r/Map-Game/pages
gh api repos/Edition-Creat0r/Map-Game/actions/workflows
gh api 'repos/Edition-Creat0r/Map-Game/deployments?environment=github-pages'
# For branch-based Pages builds, when applicable:
gh api repos/Edition-Creat0r/Map-Game/pages/builds/latest
```

These are verification steps, not permission to alter publication settings, use another identity, disable TLS, bypass API restrictions or publish an unrelated branch.
