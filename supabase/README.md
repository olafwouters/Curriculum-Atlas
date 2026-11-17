# Curriculum Atlas database version control

## Recorded baseline

Project reference: `vaazzlqfevefttbxcnqd` (not a credential).

`migrations/20261117094355_curriculum_atlas_persistence_foundation.sql`
contains the SQL applied through Supabase on 17 November 2026. Its timestamp
matches the remote migration history. Do not execute it manually against the
existing production database or mark it reverted: it is already applied.

This is the application persistence baseline, not a complete dump of every
Supabase-managed object, extension, Auth setting or existing project function.
The separate `public.rls_auto_enable()` advisor finding remains to be reviewed.

The application has NOT yet been switched from SQLite to Supabase. Authentication,
SMTP, catalogue storage/synchronisation and the recovery UI require follow-up work.
The initial administrator approval does not create an Auth account or send email.

## Files and credentials

Commit SQL migrations and this local configuration. Never commit database
passwords, secret/service-role keys, SMTP credentials, access tokens or `.env` files.
Ignore rules do not remove files already tracked by Git; review those separately.
Keep `atlas_private` out of the exposed Data API schemas.

`config.toml` configures local CLI development. This commit does not push Auth
settings to production. Configure invite-only Auth and redirect URLs separately;
the live application URL is `https://curriculum-atlas-delta.vercel.app/`.

## Local development (Supabase CLI v3)

Install the Supabase CLI and Docker using their official installation guides.
Run from the repository root:

```sh
supabase --version
supabase start
supabase db reset
```

`db reset` destroys and rebuilds the LOCAL development database. Never add a
remote target to a reset command for the production project. These local commands
have not been executed or verified by this commit.

The migration pre-approves `o.y.wouters@pl.hanze.nl`. Local Auth accounts must
still be created separately. Test permissions with actual authenticated roles;
SQL Editor/postgres access bypasses RLS and is not an authorization test.

## Future schema changes

1. Create a Git feature branch from current `main`.
2. Run `supabase migration new descriptive_change_name`.
3. Put the incremental SQL in the newly generated timestamped migration.
4. Rebuild the local database and test the change, including RLS and RPC access.
5. Commit, open a pull request and review the SQL before deployment.
6. Once a migration is applied to a shared database, do not edit or rename it.
   Fix issues through a new forward migration. Reverting a Git commit does not
   undo database changes or restore deleted data.

## Inspect the hosted migration history

Authenticate interactively; do not paste credentials into source files:

```sh
supabase login
supabase link --project-ref vaazzlqfevefttbxcnqd
supabase migration list --remote
supabase db push --dry-run --remote
```

The baseline should be recorded both locally and remotely, and no baseline SQL
should be pending. If history differs, stop and investigate. Do not blindly run
`migration repair`, `db pull`, or rerun the baseline to make errors disappear.

## Production migration procedure

There is deliberately no automatic database-deployment workflow in this commit.
Before deploying a FUTURE migration, review its dry-run, take an appropriate
backup, test recovery and authorization, and explicitly approve the production
target. The operator can then run:

```sh
supabase db push --remote
supabase migration list --remote
```

Do not deploy production credentials to ordinary pull-request or preview jobs.
GitHub branch protection and required reviews must be configured separately;
this commit only establishes the repository layout and documented workflow.

## Recovery and permissions

Approved facilitators share all workspaces and can create, edit, soft-delete
and restore them. Writes use `save_workspace` and `set_workspace_deleted`;
clients have read-only table grants and cannot directly overwrite revisions.
Session snapshots are created atomically with the workspace save.

Deletion starts a 30-day recovery window. The maintenance-only
`atlas_private.purge_expired_workspaces()` function is NOT scheduled. Do not
schedule permanent cleanup until retention and backup procedures are approved.
Facilitator approval and revocation are managed through trusted administration,
not user-editable account metadata. The `app_role` column records the initial
admin role; no user-facing administration API is installed by this migration.

## Validation status

The hosted migration succeeded and four RLS-enabled tables were verified.
End-to-end Auth, cross-facilitator saves, revision conflicts, deletion, restoration,
expiry and the local Docker rebuild still need to be tested. Version control does
not by itself certify these behaviours or resolve Supabase advisor findings.

## Official documentation

- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://supabase.com/docs/reference/cli/supabase-db-push
