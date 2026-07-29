-- Mr 4x4 Auto Service — Supabase schema for multi-device sync.
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.

-- One JSONB-per-record table per top-level db.* array in the app.
-- The app's existing entity shapes evolve ad hoc (fields added over time
-- with migration guards), so a rigid relational schema would fight the
-- app's own data model. Keeping "data jsonb" mirrors that flexibility
-- 1:1 and means the existing render code doesn't need to change shape.
create table if not exists customers      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists vehicles       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists jobs           (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists inventory      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists invoices       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists appointments   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists contracts      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists suppliers      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists purchase_orders(id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists audit_log      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists branches       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists cash_closures  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- tech_refs: the shop's own technical notes per vehicle make/model/variant
-- (service schedules, oil types, torque specs, diagrams, fault-code notes,
-- etc.) -- see src/views/techref.js for why this is deliberately empty by
-- default rather than pre-loaded. Same trust tier as jobs/customers/
-- inventory: any authenticated staff can read and maintain it (covered by
-- the blanket policy below), not Admin-restricted.
create table if not exists tech_refs      (id text primary key, data jsonb not null, updated_at timestamptz not null default now());

-- Staff needs a real column linking to Supabase Auth (real per-staff login),
-- everything else about a staff member stays in data jsonb (name, role).
create table if not exists staff (
  id text primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Single-row table for shop-wide settings (shopName, taxRate, paymentQR, ...).
create table if not exists shop_meta (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Atomic counters for job/invoice/PO numbers, so two devices creating a
-- job at the same moment never get the same WS-/INV-/PO- number.
create table if not exists counters (
  name text primary key,
  value int not null default 0
);

create or replace function next_counter(counter_name text)
returns int
language plpgsql
security definer
as $$
declare
  new_val int;
begin
  insert into counters(name, value) values (counter_name, 1)
  on conflict (name) do update set value = counters.value + 1
  returning value into new_val;
  return new_val;
end;
$$;

-- security definer bypasses RLS for its own writes, so without this,
-- anyone holding the (intentionally public) anon key could call this
-- RPC with no login at all and burn through job/invoice/PO numbers.
-- Supabase grants "anon" its own direct EXECUTE on new functions
-- (separate from PUBLIC), so it must be revoked explicitly too.
revoke execute on function next_counter(text) from public;
revoke execute on function next_counter(text) from anon;
grant execute on function next_counter(text) to authenticated;

-- Row Level Security: this is a single-shop app (not multi-tenant SaaS),
-- so the trust model is simply "logged in with real staff credentials =
-- full access", matching how the current local version already works
-- (any valid PIN sees everything). Tighten later with role-based policies
-- if you ever need e.g. mechanics blocked from certain reports.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'customers','vehicles','jobs','inventory','invoices','appointments',
    'contracts','suppliers','purchase_orders','audit_log','branches',
    'cash_closures','staff','shop_meta','counters','tech_refs'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "staff full access" on %I;', t);
    execute format(
      'create policy "staff full access" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Role-based hardening (run after the blanket policy above).
-- Everything else stays "any authenticated staff = full access" (matches
-- the UI, where only Reports/Staff/Settings are Admin-only) — these three
-- tables get tightened because the UI already treats them as Admin-only
-- or append-only, and RLS should actually enforce that, not just hide it.
-- ---------------------------------------------------------------------

-- is_admin(): true if the calling user's linked staff record has role Admin.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from staff where user_id = auth.uid() and data->>'role' = 'Admin'
  );
$$;
revoke execute on function is_admin() from public;
revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;

-- is_manager(): true for Admin OR Kerani -- mirrors the client-side
-- canManage() split in src/utils.js (Kerani gets full Admin-level access to
-- Staff/Settings/Payroll, just not revenue figures, which is a client-side-
-- only concern since no table holds "revenue" as its own row). Written
-- after is_admin() already existed and the staff/shop_meta/payroll_records
-- policies below were still Admin-only -- Kerani could see those pages in
-- the UI but every write silently failed against RLS until this was added.
create or replace function is_manager()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from staff where user_id = auth.uid() and data->>'role' in ('Admin','Kerani')
  );
$$;
revoke execute on function is_manager() from public;
revoke execute on function is_manager() from anon;
grant execute on function is_manager() to authenticated;

-- staff: everyone can read the roster (needed to assign mechanics to jobs),
-- but only Admin/Kerani can add/edit/remove staff records directly.
drop policy if exists "staff full access" on staff;
drop policy if exists "staff select" on staff;
drop policy if exists "staff admin insert" on staff;
drop policy if exists "staff admin update" on staff;
drop policy if exists "staff admin delete" on staff;
create policy "staff select" on staff for select to authenticated using (true);
create policy "staff admin insert" on staff for insert to authenticated with check (is_manager());
create policy "staff admin update" on staff for update to authenticated using (is_manager()) with check (is_manager());
create policy "staff admin delete" on staff for delete to authenticated using (is_manager());

-- shop_meta (settings): everyone reads it (shop name/tax rate/payment QR
-- show up on invoices for all staff), only Admin/Kerani can change it.
drop policy if exists "staff full access" on shop_meta;
drop policy if exists "shop_meta select" on shop_meta;
drop policy if exists "shop_meta admin insert" on shop_meta;
drop policy if exists "shop_meta admin update" on shop_meta;
drop policy if exists "shop_meta admin delete" on shop_meta;
create policy "shop_meta select" on shop_meta for select to authenticated using (true);
create policy "shop_meta admin insert" on shop_meta for insert to authenticated with check (is_manager());
create policy "shop_meta admin update" on shop_meta for update to authenticated using (is_manager()) with check (is_manager());
create policy "shop_meta admin delete" on shop_meta for delete to authenticated using (is_manager());

-- audit_log: append-only for everyone (it's an audit trail — nobody,
-- including Admins, should be able to edit or erase past entries via the
-- normal API). The app's local 300-entry cap is a display trim only and
-- no longer deletes from the cloud copy (see client-side change).
drop policy if exists "staff full access" on audit_log;
drop policy if exists "audit_log select" on audit_log;
drop policy if exists "audit_log insert" on audit_log;
create policy "audit_log select" on audit_log for select to authenticated using (true);
create policy "audit_log insert" on audit_log for insert to authenticated with check (true);

-- backups: automatic periodic snapshots of the whole shop database (see
-- src/sync-engine.js's maybeAutoBackup()), stored server-side so a recovery
-- point exists even if no Admin ever clicks "Muat Turun Sandaran" or their
-- downloaded copy ends up somewhere they can't find again. Admin-only,
-- same trust boundary as shop_meta/staff above.
create table if not exists backups (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table backups enable row level security;
drop policy if exists "backups admin select" on backups;
drop policy if exists "backups admin insert" on backups;
drop policy if exists "backups admin delete" on backups;
create policy "backups admin select" on backups for select to authenticated using (is_admin());
create policy "backups admin insert" on backups for insert to authenticated with check (is_admin());
create policy "backups admin delete" on backups for delete to authenticated using (is_admin());

-- payroll_records: a ledger of "staff X's pay for month Y was marked paid"
-- (base salary + commission, see src/views/payroll.js) -- no money actually
-- moves through the app, same as POS payment methods or the DuitNow QR;
-- this only records that a payment happened. Salary figures are more
-- sensitive than general shop revenue (which is only UI-hidden from
-- Mekanik elsewhere in the app), so this stays restricted -- but to
-- is_manager() (Admin/Kerani), not is_admin(), since Kerani was later
-- given full Admin-level access to the Payroll page itself.
create table if not exists payroll_records (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table payroll_records enable row level security;
drop policy if exists "payroll admin select" on payroll_records;
drop policy if exists "payroll admin insert" on payroll_records;
drop policy if exists "payroll admin update" on payroll_records;
drop policy if exists "payroll admin delete" on payroll_records;
create policy "payroll admin select" on payroll_records for select to authenticated using (is_manager());
create policy "payroll admin insert" on payroll_records for insert to authenticated with check (is_manager());
create policy "payroll admin update" on payroll_records for update to authenticated using (is_manager()) with check (is_manager());
create policy "payroll admin delete" on payroll_records for delete to authenticated using (is_manager());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payroll_records'
  ) then
    alter publication supabase_realtime add table payroll_records;
  end if;
  alter table payroll_records replica identity full;
end $$;

-- kiosk_lookup_job(): anonymous-safe job status lookup by job number or
-- plate, for a real customer checking status from their own phone (never
-- logged in). Returns ONLY the minimal fields the public kiosk screen
-- shows (see src/login-kiosk.js) -- no customer name/phone, no internal
-- notes, no mechanic name, no pricing -- security definer so this one
-- narrow read works despite jobs/vehicles requiring "authenticated" for
-- everything else via RLS above.
create or replace function kiosk_lookup_job(query text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  rec record;
begin
  select j.id, j.data->>'jobNo' as job_no, j.data->>'status' as status,
         j.data->'rating' as rating, j.data->>'feedback' as feedback,
         v.data->>'plate' as plate, v.data->>'model' as model
    into rec
    from jobs j
    left join vehicles v on v.id = j.data->>'vehicleId'
    where lower(j.data->>'jobNo') = lower(query)
    limit 1;

  if not found then
    select j.id, j.data->>'jobNo' as job_no, j.data->>'status' as status,
           j.data->'rating' as rating, j.data->>'feedback' as feedback,
           v.data->>'plate' as plate, v.data->>'model' as model
      into rec
      from jobs j
      join vehicles v on v.id = j.data->>'vehicleId'
      where replace(lower(v.data->>'plate'), ' ', '') = replace(lower(query), ' ', '')
      order by j.updated_at desc
      limit 1;
  end if;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', rec.id, 'jobNo', rec.job_no, 'status', rec.status,
    'rating', rec.rating, 'feedback', rec.feedback,
    'plate', rec.plate, 'model', rec.model
  );
end;
$$;
revoke execute on function kiosk_lookup_job(text) from public;
grant execute on function kiosk_lookup_job(text) to anon;
grant execute on function kiosk_lookup_job(text) to authenticated;

-- kiosk_submit_feedback(): anonymous-safe write, narrowly scoped -- can
-- only set rating+feedback on a job that's already 'delivered' and has no
-- rating yet (no overwriting an existing rating, no touching any other
-- field on any other row).
create or replace function kiosk_submit_feedback(p_job_id text, p_rating int, p_feedback text)
returns boolean
language plpgsql
security definer
as $$
declare
  cur jsonb;
begin
  if p_rating < 1 or p_rating > 5 then
    return false;
  end if;

  select data into cur from jobs where id = p_job_id and data->>'status' = 'delivered';
  if not found then
    return false;
  end if;
  if (cur ? 'rating') and cur->'rating' is not null then
    return false;
  end if;

  update jobs
    set data = data || jsonb_build_object('rating', p_rating, 'feedback', coalesce(p_feedback, '')),
        updated_at = now()
    where id = p_job_id;
  return true;
end;
$$;
revoke execute on function kiosk_submit_feedback(text, int, text) from public;
grant execute on function kiosk_submit_feedback(text, int, text) to anon;
grant execute on function kiosk_submit_feedback(text, int, text) to authenticated;

-- claim_staff_record(): lets a newly signed-up user link themselves to an
-- existing staff row by matching email (added by an Admin beforehand), or
-- become the shop's first Admin if no staff records exist yet at all.
-- security definer so this one narrow operation can run even though direct
-- staff table writes are now Admin-only above — it can only ever claim a
-- row matching the caller's own verified auth email, never anyone else's,
-- and can only self-assign Admin in the empty-table bootstrap case.
create or replace function claim_staff_record()
returns jsonb
language plpgsql
security definer
as $$
declare
  my_email text;
  rec staff%rowtype;
  new_id text;
begin
  my_email := lower(auth.jwt()->>'email');

  select * into rec from staff where user_id = auth.uid();
  if found then
    return jsonb_build_object('id', rec.id, 'user_id', rec.user_id, 'data', rec.data);
  end if;

  select * into rec from staff where lower(data->>'email') = my_email and user_id is null limit 1;
  if found then
    update staff set user_id = auth.uid() where id = rec.id;
    return jsonb_build_object('id', rec.id, 'user_id', auth.uid(), 'data', rec.data);
  end if;

  if (select count(*) from staff) = 0 then
    new_id := md5(random()::text || clock_timestamp()::text);
    insert into staff(id, user_id, data) values (
      new_id, auth.uid(),
      jsonb_build_object('name', split_part(my_email,'@',1), 'role','Admin','email', my_email, 'commissionPercent',0)
    );
    return jsonb_build_object('id', new_id, 'user_id', auth.uid(), 'data', jsonb_build_object('name', split_part(my_email,'@',1), 'role','Admin','email', my_email, 'commissionPercent',0));
  end if;

  return null;
end;
$$;
revoke execute on function claim_staff_record() from public;
revoke execute on function claim_staff_record() from anon;
grant execute on function claim_staff_record() to authenticated;

-- Realtime: let other open devices hear about changes as they happen.
-- Checked per-table (rather than a plain ALTER PUBLICATION ... ADD TABLE)
-- so this script is safe to run more than once.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'customers','vehicles','jobs','inventory','invoices','appointments',
    'contracts','suppliers','purchase_orders','audit_log','branches',
    'cash_closures','staff','shop_meta','tech_refs'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
    -- Postgres's logical replication only sends the primary key for the
    -- "old row" on UPDATE/DELETE by default. Supabase Realtime needs the
    -- full old row to check it against RLS before deciding whether to
    -- broadcast — without this, DELETE (and UPDATE) events are silently
    -- dropped instead of reaching other devices, even though INSERT works.
    execute format('alter table %I replica identity full;', t);
  end loop;
end $$;
