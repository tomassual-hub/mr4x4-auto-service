-- Distributed lock for the shared Supabase TEST project (see tests/README.md
-- and build/build-test.js -- this is a completely separate, isolated
-- project from both production AND the central licensing project, so this
-- table only ever affects test runs, never real shop data).
--
-- CI already serializes its OWN runs against each other via the
-- `concurrency` group in .github/workflows/ci.yml, but that only protects
-- CI runs from each other -- a developer running `npm test` locally while
-- CI is also running has no such protection, and both would hit this same
-- shared account/backend at once (RLS 403s, unexpected record counts,
-- timing flakes that look like real regressions but aren't). This
-- table+RPC pair gives every runner -- local or CI -- a shared mutex to
-- coordinate through, wherever it's invoked from. See tests/lock.js for
-- the client side.
--
-- Run this ONCE in the TEST project's own SQL Editor (not production's --
-- this is test-harness infrastructure, not part of any shop's schema, so
-- it deliberately does NOT live in backend/schema.sql).
create table if not exists test_run_lock (
  id text primary key default 'singleton',
  holder text,
  acquired_at timestamptz
);
insert into test_run_lock (id) values ('singleton') on conflict (id) do nothing;
alter table test_run_lock enable row level security;
revoke all on test_run_lock from anon, authenticated;

-- acquire_test_lock(): true if the lock was free (or stale) and this holder
-- now owns it, false if someone else currently holds it. 20-minute stale
-- timeout -- comfortably longer than a full `npm test` run, including its
-- own per-file retries, ever takes -- so a run that crashed or got killed
-- without releasing the lock unblocks itself instead of wedging every
-- future run forever.
create or replace function acquire_test_lock(p_holder text)
returns boolean
language plpgsql
security definer
as $$
begin
  update test_run_lock
    set holder = p_holder, acquired_at = now()
    where id = 'singleton' and (holder is null or acquired_at < now() - interval '20 minutes');
  return found;
end;
$$;

create or replace function release_test_lock(p_holder text)
returns void
language sql
security definer
as $$
  update test_run_lock set holder = null, acquired_at = null
    where id = 'singleton' and holder = p_holder;
$$;

revoke execute on function acquire_test_lock(text) from public;
grant execute on function acquire_test_lock(text) to anon;
revoke execute on function release_test_lock(text) from public;
grant execute on function release_test_lock(text) to anon;
