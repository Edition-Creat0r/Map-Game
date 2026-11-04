# Resource icon review — checkpoint 1

Base: graphics branch dba4aac; its three commits and clean tree were preserved.
Reinspection confirms procedural smallHouse/steelMill/officeLow, opt-in Regular-only
hook, hysteretic LODs, road fallback, five PNGs, bounded ZIP tooling, screenshots
and existing preference integration. There are no finished building GLBs. Regular
world rendering remains paused. Archived screenshots/JSON support the reported
15.04 → 13.66 software FPS result, not hardware GPU or live deployment approval.
Fresh pre-change tests: 135 Node tests and 16 graphics-pack tests passed.

The actual registry contains 139 internal materials, 140 industrial definitions,
five starter contracts, 118 player-facing materials and 14 research nodes. The
older 121 count must not be used to truncate mappings or inventory.

## Pack blocker

ModernResource_Free.zip was not found in the available /workspace or /tmp files.
Actual supplied PNG count validated: **none**. The claimed 124 files have not been
inspected. No pack source or redistribution license is available. No pack icon
was imported. Attach the ZIP and the author's source/license terms before mapping
images or publishing them. A 'free' filename does not establish commercial rights.

mapping-review.json explicitly lists all 139 IDs as pending; none is assigned an
invented icon number. Existing material tokens remain. Money separately uses the
original credit.svg: authored for this project, dedicated CC0-1.0. It only changes
the existing Money presentation, never creates a second balance/currency.

## Read-only audit (no extraction/import)

Use Python 3 with Pillow 12.3.0 or newer in a trusted local virtual environment:

```powershell
py -m venv .venv-icons
.\.venv-icons\Scripts\python.exe -m pip install 'Pillow==12.3.0'
.\.venv-icons\Scripts\python.exe resource-icons/tools/audit_zip.py "$HOME\Downloads\ModernResource_Free.zip" > "$HOME\Downloads\resource-audit.json"
.\.venv-icons\Scripts\python.exe resource-icons/tools/test_audit_zip.py
```

The audit reads only; reports size/dimensions/transparency/checksums; rejects
unexpected paths, symlinks, duplicate/case-colliding names, encryption, excess
sizes/ratios, invalid CRC/chunks, non-PNG, wrong dimensions, animation, invisible
icons and trailing payload. It never marks licensing approved. Synthetic test PNGs
are temporary fixtures, not substitutes for the missing artwork. Existing terrain
pack validation stays separate and unchanged. No ZIP is downloaded or uploaded.
