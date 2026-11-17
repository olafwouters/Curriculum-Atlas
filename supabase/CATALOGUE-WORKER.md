# Resumable catalogue worker

Requires the existing catalogue_storage migration AND the separately approved
20261117190000_catalogue_worker.sql migration. This commit does not apply SQL,
configure secrets, schedule jobs, start a live crawl or enable website controls.
Run only in a trusted, persistent worker process, not inside a Flask/Vercel request.
Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in that worker's secret store.
The latter must be a legacy service_role JWT, not a publishable key or sb_secret
key. Never put it in browser configuration, chat, source code or untrusted PR jobs.

Start: python atlas_catalogue_worker.py --year 2026
Resume: python atlas_catalogue_worker.py --year 2026 --version <printed-UUID>
Use --once --max-tasks 25 for one slice; the default CLI repeats slices until done.
A supervisor may rerun the same command/UUID after a failure. A killed worker's
lease expires after 120 seconds; takeover rejects stale owners. Heartbeats run
between source requests (20-second throttle), which retain bounded source retries.

Both languages' programme/course indexes become database tasks in bounded batches.
Completed details and their linked-course tasks commit together; completed tasks
are not downloaded again after restart. An interrupted listing restarts that one
listing; its pagination is validated as a whole before its index is accepted.
Independently listed courses and programme-only references are both downloaded.
Final listing rechecks compare counts and path digests before atomic publication.
MD5 here is only change detection, not authentication. Upstream has no transactional
snapshot: edited document contents cannot be frozen across a long crawl. If index
verification fails, start a new version; the previously published version stays put.

Errors leave the task pending and save only a generic message. Source documents
remain private until bilingual publication validates counts and references. Jobs
and entries have no automatic retention/deletion policy. The original worker-write
RPC remains a trusted administrative primitive: do not bypass this queue protocol
while a worker owns a version. UI/API job submission is the next integration step.

Local tests mock source/RPC. SQL CI uses real PostgreSQL with fixtures; it is not
a live crawl or hosted permission test. The worker is connected to the existing
downloader and Supabase publish RPC, not yet to website buttons or a scheduler.
