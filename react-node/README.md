# Curriculum Atlas React / Node.js preview

First working-slice candidate, NOT the completed migration. Includes creating/importing/loading a workspace, a module/course matrix, alignment editing, manual saving with revision checks, reloading and raw-state JSON export. Existing IDs, unknown fields and legacy course-key spelling are preserved; ambiguous keys are refused. Imports support raw state and {state: ...}, not bulk backups. Full legacy interchange compatibility still needs browser testing.

Not migrated: catalogue/cache, charts, CSV, library, targets editor, competence-set management, sessions UI, year-copy/archive/delete, language/theme and original styling. New modules default to year 1; module/course management is not complete. Unsupported data remains in state JSON. This is for isolated testing only.

## Local

Requires Node 24 (minimum 22.13); no Python. Keep react-node inside the original repository: the server reads ../framework.json. From repository root:

    npm --prefix react-node install
    npm --prefix react-node test
    npm --prefix react-node run build
    npm --prefix react-node start

Open http://127.0.0.1:3001. Default database: react-node/.data/preview.sqlite3, NOT data/compass.sqlite3. Import an exported copy; never connect this candidate to the production database. For development run the server and npm --prefix react-node run dev separately.

## Separate Render test service

Select Node runtime and react-node-migration branch; leave Root Directory empty. Build: npm --prefix react-node install && npm --prefix react-node run build. Start: npm --prefix react-node start.

Set NODE_VERSION=24, NODE_ENV=production, ATLAS_USER and a unique random ATLAS_PASSWORD of at least 16 characters. Use HTTPS. Browser Basic Auth is a shared preview gate, not individual accounts. No secrets in commits/frontend variables. Public health route: /api/health.

Use a separate persistent disk at /var/data and ATLAS_DATA_DIR=/var/data/atlas-react-preview. Check hosting costs first; disks may require a paid service. Without persistent storage, data may be lost after redeploy/restart. No hosting resources are created by these files.

## Verification

The suite tests domain behavior and real HTTP/SQLite behavior on supported Node versions; the latter is skipped below Node 22. GitHub Actions uses Node 24 and runs tests and the frontend build after push. A skip is not a pass. Browser/Render checks remain outstanding. Dependency ranges are initial candidates: generate/review a lockfile on Node 24 and switch deployment to npm ci before production use.

Manually test import, module/course mapping edits, save, reload, export and two-tab revision conflicts against copies of existing JSON. Compare all unchanged fields. Review every unported feature before replacing the old app.

Existing Python/Flet workflows are unchanged and may also run or fail on a branch push. Check the separate React Node preview checks workflow; its success must not be inferred from unrelated jobs. The inspected Pages deploy jobs are restricted to other branches/main; no new deploy step is added here.
