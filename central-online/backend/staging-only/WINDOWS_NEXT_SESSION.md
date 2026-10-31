# Next Lenovo session — offline only

No Supabase login, linking, SQL Editor, db push, deployment or spending activation
is needed. Keep Docker's database containers local and disposable.

1. **Get this branch**, from your existing Map Game checkout:
   ```powershell
   git status --short
   # If this lists work, preserve it before switching; do not reset it.
   git fetch origin
   git switch feature/0.4.1-security-preparation
   git pull --ff-only origin feature/0.4.1-security-preparation
   ```
2. **Locate the export in File Explorer.** Keep `map-game-original-schema.sql`
   outside the repository, the served game folder and OneDrive/shared folders.
   Use a private folder accessible only to your Windows account. Do not attach
   the export to chat or commit it. If it is not present, stop; do not download
   from production as part of this offline session.
3. **Run the read-only scanner in PowerShell 7.2+**, replacing only the local path:
   ```powershell
   $Schema = Join-Path $env:LOCALAPPDATA 'MapGame\private-schema-review\map-game-original-schema.sql'
   $Reports = Join-Path $env:LOCALAPPDATA 'MapGame\private-security-review'
   pwsh -NoProfile -File .\central-online\backend\staging-only\tools\Review-LocalSchema.ps1 -SchemaPath $Schema -ReportDirectory $Reports
   $LASTEXITCODE
   ```
   **2 means a report was made and review is required.** 1 means it stopped:
   check the path, PowerShell 7.2+, UTF-8 SQL format, file size and private locations.
   Do not disable execution policies or TLS to make it work. No SQL is executed.
4. **Open the newest `review-*` folder** inside `$Reports`. Read
   `security-review.md`; retain its JSON partner and checksum privately. Findings
   refer to line numbers in your original export. Do not copy raw SQL, passwords
   or tokens into chat. Share only sanitized finding codes/counts if needed.
   Missing owner/global-role evidence is expected from a public/no-owner export
   and still blocks approval. A clean-looking report never authorizes deployment.
5. **If time permits**, start Docker Desktop and run the commands in
   [SECURITY_PREPARATION.md](SECURITY_PREPARATION.md#validation-commands). The pinned
   PostgreSQL test image must already be cached; the hardening runner refuses to
   pull it. If missing, stop and record the prerequisite rather than substituting
   a different image. These are synthetic tests, not real two-account tests.
6. **Stop and report.** Keep the real export and reports private. Record test
   counts, scanner exit code and sanitized findings. The next approval needs a
   complete private schema review, confirmed staging identity and genuine
   two-account test plan. Keep Central spending OFF.

Future approved order only: reviewed baseline -> reviewed hardening -> 001 ->
002 -> 003. Never deploy `tests/bootstrap.sql` or
`staging-only/tests/legacy-model.fixture.sql`. Nothing in this checklist approves
an import, modifies production or deploys the game.
