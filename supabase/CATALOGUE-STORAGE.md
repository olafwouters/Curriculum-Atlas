# Catalogue storage implementation

This additive migration is NOT applied automatically to the hosted database.
Apply it only after the disposable PostgreSQL CI passes and separate approval.
Existing workspace tables, data and previous migrations are unchanged.

Private RLS-enabled tables store immutable published versions, per-language
programme/course JSON documents and an atomic per-edition active-version pointer.
Only the service_role RPC can stage entries, store checkpoints, mark failures or
publish. Normal approved facilitators can read published versions via the read
RPC; they cannot modify tables or invoke the worker RPC. No worker credential is
stored in this code. Any future service-role credential belongs only in a trusted
worker secret store, never the browser, PR jobs, logs or client configuration.

The injected Python RPC transport takes a function name and keyword arguments.
A signed-in application can inject atlas_supabase.rpc for reads. Worker writes
require a separate trusted transport. Batches are bounded by bytes and row count.
Publication validates BOTH languages, stored counts and referenced courses in one
transaction. Failed or stale updates cannot replace the last published version.
Read pagination returns a version ID; pass it on subsequent reads to pin a snapshot.
No versions are automatically deleted; retention needs an approved future policy.

CI runs real PostgreSQL using dummy roles/Auth functions in catalogue_ci, plus the
existing foundation migration. This is not live Supabase or real user-token testing.
Python tests mock transport calls. Neither substitutes for hosted role verification.

This commit is STORAGE ONLY. It does not start crawls, provide worker scheduling,
wire Flask/UI endpoints or lift the current hosted catalogue guard. Those remain
separate integration work. A checkpoint is a storage primitive, not a running job.
