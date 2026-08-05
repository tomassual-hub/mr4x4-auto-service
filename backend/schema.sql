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
-- leads: Workshop CRM prospects who haven't had a job/invoice yet (see
-- src/views/customers.js's leadsTabHTML/LEAD_STAGES) -- same open trust
-- tier as customers/jobs, not Admin-restricted.
create table if not exists leads          (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- packages: bundled service/part combos sold at a package price (see
-- src/event-handlers.js's save-package/add-package-to-cart) -- same open
-- trust tier as inventory, not Admin-restricted.
create table if not exists packages       (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- credit_notes: refund/adjustment documents issued against an invoice (see
-- save-credit-note) -- same open trust tier as invoices.
create table if not exists credit_notes   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- attendance: clock in/out records punched via a staff member's personal
-- QR code (see attendance_status/attendance_punch below) or edited by an
-- Admin/Kerani in the Staff → Attendance tab. Direct table access stays
-- "authenticated only" like everything else here -- the anonymous punch
-- flow goes through the two security-definer RPCs below instead, never
-- through this table directly, so anon never gets a standing grant on it.
create table if not exists attendance     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- quotations: pre-sale estimates that can later convert into an invoice
-- (see save-quotation/convert-quote-to-invoice) -- same open trust tier as
-- invoices, not Admin-restricted.
create table if not exists quotations     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- bays: physical workshop lifts/stations a job can optionally be parked on
-- (see the "Bay Management" section in Settings and the Bay field on job
-- cards) -- same open trust tier as branches, not Admin-restricted.
create table if not exists bays           (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- support_messages: internal staff <-> management help channel (see
-- src/support-chat.js) -- one thread per non-manager staff member, not
-- restricted to Admin/Kerani/Pemilik like staff/shop_meta/payroll_records
-- below, since a regular Mekanik has to be able to write into their own
-- thread too. Same open trust tier as jobs/customers, not Admin-only.
create table if not exists support_messages(id text primary key, data jsonb not null, updated_at timestamptz not null default now());

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
    'cash_closures','staff','shop_meta','counters','tech_refs','leads',
    'packages','credit_notes','attendance','quotations','bays'
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

-- is_admin(): true if the calling user's linked staff record has role Admin
-- OR Pemilik -- Pemilik is a same-access-as-Admin role (see canSeeRevenue()/
-- isOwnerLevel() in src/utils.js) added later than this function; without
-- 'Pemilik' listed here too, switching an account to Pemilik makes the UI
-- claim full access while every actual write against Admin-gated tables
-- gets silently rejected by RLS underneath it.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from staff where user_id = auth.uid() and data->>'role' in ('Admin','Pemilik')
  );
$$;
revoke execute on function is_admin() from public;
revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;

-- is_manager(): true for Admin/Pemilik OR Kerani -- mirrors the client-side
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
    select 1 from staff where user_id = auth.uid() and data->>'role' in ('Admin','Pemilik','Kerani')
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

-- is_manager() (Kerani included) can write to `staff` at all -- needed so
-- Kerani can add/edit Mekanik accounts -- but without this trigger a
-- Kerani could set their OWN row's role to 'Admin' or 'Pemilik' via a
-- direct API call and self-escalate to full revenue access, since RLS
-- above only checks WHO is writing, never WHICH role value they're
-- writing. Bootstrap exception: claim_staff_record() self-assigns Admin
-- when the staff table is still completely empty (the shop's very first
-- login) -- there's no existing Admin yet to have approved that one, so
-- it's allowed through once, and only then.
create or replace function validate_staff_role_write()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.data->>'role') in ('Admin','Pemilik') and not is_admin() then
    if TG_OP = 'INSERT' and (select count(*) from staff) = 0 then
      return new;
    end if;
    raise exception 'Only Admin/Pemilik can assign the Admin or Pemilik role';
  end if;
  return new;
end;
$$;
drop trigger if exists staff_validate_role on staff;
create trigger staff_validate_role before insert or update on staff
  for each row execute function validate_staff_role_write();

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

-- support_messages: one thread per non-manager staff member (see
-- src/support-chat.js) -- meant to be private between that staff member
-- and management, NOT visible to every other Mekanik the way jobs/
-- customers/etc. are. Previously sat in the blanket "any authenticated
-- staff = full access" policy above, which meant any staff member could
-- read every OTHER staff member's private thread with management (and
-- write into it) via a direct API call, entirely bypassing the
-- thread-scoping that only ever existed client-side. Scoped here to
-- "your own thread, or any thread if you're a manager" instead.
alter table support_messages enable row level security;
drop policy if exists "staff full access" on support_messages;
drop policy if exists "support_messages select" on support_messages;
drop policy if exists "support_messages insert" on support_messages;
drop policy if exists "support_messages update" on support_messages;
drop policy if exists "support_messages delete" on support_messages;
create policy "support_messages select" on support_messages for select to authenticated
  using (is_manager() or data->>'threadStaffId' = (select id from staff where user_id = auth.uid()));
create policy "support_messages insert" on support_messages for insert to authenticated
  with check (is_manager() or data->>'threadStaffId' = (select id from staff where user_id = auth.uid()));
create policy "support_messages update" on support_messages for update to authenticated
  using (is_manager() or data->>'threadStaffId' = (select id from staff where user_id = auth.uid()))
  with check (is_manager() or data->>'threadStaffId' = (select id from staff where user_id = auth.uid()));
create policy "support_messages delete" on support_messages for delete to authenticated
  using (is_manager() or data->>'threadStaffId' = (select id from staff where user_id = auth.uid()));

-- Row-level scoping above stops reading/writing someone ELSE's thread, but
-- doesn't stop a staff member writing INTO their own thread while lying
-- about who a message is from (e.g. senderSide:'manager' to impersonate a
-- reply from the boss). This closes that: the sender identity on every row
-- must match who's actually making the call.
create or replace function validate_support_message()
returns trigger
language plpgsql
security definer
as $$
declare
  my_staff_id text;
begin
  select id into my_staff_id from staff where user_id = auth.uid();
  if (new.data->>'senderId') is distinct from my_staff_id then
    raise exception 'senderId must match your own staff id';
  end if;
  if (new.data->>'senderSide' = 'manager') <> is_manager() then
    raise exception 'senderSide must match your actual role';
  end if;
  return new;
end;
$$;
drop trigger if exists support_messages_validate on support_messages;
create trigger support_messages_validate before insert or update on support_messages
  for each row execute function validate_support_message();

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
    'cash_closures','staff','shop_meta','tech_refs','leads',
    'packages','credit_notes','attendance','quotations','bays',
    'support_messages'
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

-- attendance_status()/attendance_punch(): anonymous-safe QR clock in/out
-- (see src/attendance.js and the "Attendance QR Code" button in
-- src/views/staff.js). A staff member's printed QR links to
-- ?attendance=<staffId>&token=<attendanceToken> with no login at all --
-- these two RPCs are the only way that token can do anything, and both
-- fail closed (return null/false) the moment the token doesn't match the
-- current one on that staff row, so regenerating the code from the app
-- immediately revokes any old printed copy.
create or replace function attendance_status(p_staff_id text, p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  s record;
  last_type text;
begin
  select data->>'name' as name, data->>'attendanceToken' as token
    into s
    from staff where id = p_staff_id;

  if not found or s.token is null or s.token <> p_token then
    return null;
  end if;

  select data->>'type' into last_type
    from attendance
    where data->>'staffId' = p_staff_id
    order by (data->>'ts')::bigint desc
    limit 1;

  return jsonb_build_object(
    'name', s.name,
    'nextType', case when last_type = 'in' then 'out' else 'in' end
  );
end;
$$;
revoke execute on function attendance_status(text, text) from public;
grant execute on function attendance_status(text, text) to anon;
grant execute on function attendance_status(text, text) to authenticated;

create or replace function attendance_punch(p_staff_id text, p_token text)
returns jsonb
language plpgsql
security definer
as $$
declare
  s record;
  last_type text;
  next_type text;
  new_id text;
  now_ms bigint;
begin
  select data->>'name' as name, data->>'attendanceToken' as token
    into s
    from staff where id = p_staff_id;

  if not found or s.token is null or s.token <> p_token then
    return null;
  end if;

  select data->>'type' into last_type
    from attendance
    where data->>'staffId' = p_staff_id
    order by (data->>'ts')::bigint desc
    limit 1;

  next_type := case when last_type = 'in' then 'out' else 'in' end;
  new_id := md5(random()::text || clock_timestamp()::text);
  now_ms := (extract(epoch from now()) * 1000)::bigint;

  insert into attendance(id, data) values (
    new_id,
    jsonb_build_object('id', new_id, 'staffId', p_staff_id, 'staffName', s.name, 'type', next_type, 'ts', now_ms)
  );

  return jsonb_build_object('name', s.name, 'type', next_type, 'ts', now_ms);
end;
$$;
revoke execute on function attendance_punch(text, text) from public;
grant execute on function attendance_punch(text, text) to anon;
grant execute on function attendance_punch(text, text) to authenticated;

-- kiosk_inspection_report()/kiosk_submit_inspection_signature(): anonymous-
-- safe "Share Report" flow for a vehicle inspection (see
-- src/inspection-report.js and the "Share Report" button in the staff
-- inspection modal). The link is ?inspect=<jobId>&token=<inspectionToken>
-- -- a random token generated the first time a report is shared, distinct
-- from the job's own id, so a stranger can't view/sign a report just by
-- guessing or enumerating job ids. Returns only inspection-related fields
-- (no customer name/phone, no pricing, no internal notes), same minimal-
-- surface principle as kiosk_lookup_job below.
create or replace function kiosk_inspection_report(p_job_id text, p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  rec record;
begin
  select j.data->>'jobNo' as job_no, j.data->>'status' as status,
         j.data->>'inspectionToken' as token,
         coalesce(j.data->'inspection', '{}'::jsonb) as inspection,
         coalesce(j.data->'diagramMarks', '[]'::jsonb) as diagram_marks,
         coalesce(j.data->'photos', '[]'::jsonb) as photos,
         (j.data->>'customerInspectionSignature') is not null as signed,
         v.data->>'plate' as plate, v.data->>'model' as model
    into rec
    from jobs j
    left join vehicles v on v.id = j.data->>'vehicleId'
    where j.id = p_job_id;

  if not found or rec.token is null or rec.token <> p_token then
    return null;
  end if;

  return jsonb_build_object(
    'jobNo', rec.job_no, 'status', rec.status, 'plate', rec.plate, 'model', rec.model,
    'inspection', rec.inspection, 'diagramMarks', rec.diagram_marks, 'photos', rec.photos,
    'signed', rec.signed
  );
end;
$$;
revoke execute on function kiosk_inspection_report(text, text) from public;
grant execute on function kiosk_inspection_report(text, text) to anon;
grant execute on function kiosk_inspection_report(text, text) to authenticated;

create or replace function kiosk_submit_inspection_signature(p_job_id text, p_token text, p_signature text)
returns boolean
language plpgsql
security definer
as $$
declare
  cur jsonb;
begin
  select data into cur from jobs where id = p_job_id;
  if not found then
    return false;
  end if;
  if (cur->>'inspectionToken') is null or (cur->>'inspectionToken') <> p_token then
    return false;
  end if;
  if (cur->>'customerInspectionSignature') is not null then
    return false;
  end if;

  update jobs
    set data = data || jsonb_build_object('customerInspectionSignature', p_signature),
        updated_at = now()
    where id = p_job_id;
  return true;
end;
$$;
revoke execute on function kiosk_submit_inspection_signature(text, text, text) from public;
grant execute on function kiosk_submit_inspection_signature(text, text, text) to anon;
grant execute on function kiosk_submit_inspection_signature(text, text, text) to authenticated;

-- kiosk_list_active_jobs(): anonymous-safe feed for the waiting-area
-- Display Board (see src/display-board.js) -- a TV/tablet at the shop
-- polls this every ~20s. Same minimal-surface principle as
-- kiosk_lookup_job: only job no./plate/model/status for jobs not yet
-- delivered, never customer name/phone/pricing/mechanic.
create or replace function kiosk_list_active_jobs()
returns jsonb
language sql
security definer
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobNo', j.data->>'jobNo', 'status', j.data->>'status',
    'plate', v.data->>'plate', 'model', v.data->>'model'
  )), '[]'::jsonb)
  from jobs j
  left join vehicles v on v.id = j.data->>'vehicleId'
  where j.data->>'status' in ('waiting','progress','done');
$$;
revoke execute on function kiosk_list_active_jobs() from public;
grant execute on function kiosk_list_active_jobs() to anon;
grant execute on function kiosk_list_active_jobs() to authenticated;

-- push_subscriptions: Web Push endpoints registered per staff device (see
-- src/push-notifications.js) -- synced like every other db.* array via
-- TABLE_MAP, but scoped to "your own devices only", same trust tier as
-- support_messages, not the open "any staff" tier most tables above use.
-- A staff member has no legitimate reason to read or delete another staff
-- member's raw push endpoint. The Edge Function that actually SENDS
-- notifications (see supabase/functions/notify-support-message/) runs with
-- the service-role key and bypasses RLS entirely, so it can still reach
-- every subscription regardless of this scoping.
create table if not exists push_subscriptions(id text primary key, data jsonb not null, updated_at timestamptz not null default now());
alter table push_subscriptions enable row level security;
drop policy if exists "push_subscriptions select" on push_subscriptions;
drop policy if exists "push_subscriptions insert" on push_subscriptions;
drop policy if exists "push_subscriptions update" on push_subscriptions;
drop policy if exists "push_subscriptions delete" on push_subscriptions;
create policy "push_subscriptions select" on push_subscriptions for select to authenticated
  using (data->>'staffId' = (select id from staff where user_id = auth.uid()));
create policy "push_subscriptions insert" on push_subscriptions for insert to authenticated
  with check (data->>'staffId' = (select id from staff where user_id = auth.uid()));
create policy "push_subscriptions update" on push_subscriptions for update to authenticated
  using (data->>'staffId' = (select id from staff where user_id = auth.uid()))
  with check (data->>'staffId' = (select id from staff where user_id = auth.uid()));
create policy "push_subscriptions delete" on push_subscriptions for delete to authenticated
  using (data->>'staffId' = (select id from staff where user_id = auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'push_subscriptions'
  ) then
    alter publication supabase_realtime add table push_subscriptions;
  end if;
  alter table push_subscriptions replica identity full;
end $$;

-- notify_new_support_message trigger: fires an HTTP call to the
-- notify-support-message Edge Function (see supabase/functions/) on every
-- new support message, so the recipient gets a real push notification even
-- if the app is fully closed. Uses pg_net (bundled with every Supabase
-- project) rather than requiring a separate cron/poller -- the call is
-- fire-and-forget (net.http_post queues it async) so a slow/unreachable
-- Edge Function never blocks or fails the message insert itself.
--
-- The function URL/key live in this small table rather than
-- `app.settings.*` database parameters -- `alter database ... set` needs
-- superuser, which Supabase's SQL Editor role doesn't have (confirmed via
-- "permission denied to set parameter" when that was tried). A plain table
-- (same pattern as license_config in central-schema.sql) needs no special
-- privilege at all -- it's owned by the same role running this script.
create table if not exists edge_function_config (
  id text primary key default 'singleton',
  edge_function_url text,
  edge_function_anon_key text
);
alter table edge_function_config enable row level security;
revoke all on edge_function_config from anon, authenticated;
insert into edge_function_config (id) values ('singleton') on conflict (id) do nothing;

-- Set once per project (see supabase/functions/README.md) via:
--   update edge_function_config set
--     edge_function_url = 'https://<project-ref>.functions.supabase.co/notify-support-message',
--     edge_function_anon_key = '<anon key>'
--   where id = 'singleton';
-- Until that's run, this trigger silently no-ops (both columns null)
-- rather than breaking support chat.
create extension if not exists pg_net with schema extensions;

create or replace function notify_new_support_message()
returns trigger
language plpgsql
security definer
as $$
declare
  fn_url text;
  fn_key text;
begin
  select edge_function_url, edge_function_anon_key into fn_url, fn_key
    from edge_function_config where id = 'singleton';
  if fn_url is not null and fn_key is not null then
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_key),
      body := jsonb_build_object(
        'id', new.id,
        'threadStaffId', new.data->>'threadStaffId',
        'senderId', new.data->>'senderId',
        'senderName', new.data->>'senderName',
        'senderSide', new.data->>'senderSide',
        'message', new.data->>'message'
      )
    );
  end if;
  return new;
end;
$$;
drop trigger if exists support_messages_notify on support_messages;
create trigger support_messages_notify after insert on support_messages
  for each row execute function notify_new_support_message();

-- ---------------------------------------------------------------------
-- Customer-facing self-service: quotation approval, vehicle service
-- history, appointment requests, invoice/receipt viewing. Same
-- anonymous-safe, token-gated pattern as kiosk_lookup_job/
-- kiosk_inspection_report above -- security definer functions returning
-- only the minimal fields each screen needs, never direct table access.
-- ---------------------------------------------------------------------

-- kiosk_get_quotation()/kiosk_respond_quotation(): the customer's side of
-- "share a quotation for approval" (see the "Share for Approval" button in
-- the staff Quotations tab). Link is ?quote=<id>&token=<quoteToken> -- the
-- token is set client-side on the quotation record the same way
-- inspectionToken is set on a job (staff already has full write access to
-- quotations via the blanket policy above), so no separate RPC is needed
-- just to generate/share the link, only to read/respond to it anonymously.
create or replace function kiosk_get_quotation(p_quote_id text, p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  rec record;
begin
  select q.data->>'quoteNo' as quote_no, q.data->>'status' as status,
         q.data->>'quoteToken' as token, q.data->'items' as items,
         (q.data->>'subtotal')::numeric as subtotal, (q.data->>'discount')::numeric as discount,
         (q.data->>'taxRate')::numeric as tax_rate, (q.data->>'tax')::numeric as tax,
         (q.data->>'total')::numeric as total, (q.data->>'createdAt')::bigint as created_at,
         c.data->>'name' as customer_name, v.data->>'plate' as plate, v.data->>'model' as model
    into rec
    from quotations q
    left join customers c on c.id = q.data->>'customerId'
    left join vehicles v on v.id = q.data->>'vehicleId'
    where q.id = p_quote_id;

  if not found or rec.token is null or rec.token <> p_token then
    return null;
  end if;

  return jsonb_build_object(
    'quoteNo', rec.quote_no, 'status', rec.status, 'items', rec.items,
    'subtotal', rec.subtotal, 'discount', rec.discount, 'taxRate', rec.tax_rate,
    'tax', rec.tax, 'total', rec.total, 'createdAt', rec.created_at,
    'customerName', rec.customer_name, 'plate', rec.plate, 'model', rec.model
  );
end;
$$;
revoke execute on function kiosk_get_quotation(text, text) from public;
grant execute on function kiosk_get_quotation(text, text) to anon;
grant execute on function kiosk_get_quotation(text, text) to authenticated;

-- Only moves a quotation OUT of 'sent' -- can't approve/reject a draft
-- (never shared), and can't respond twice to one already accepted/rejected/
-- converted/expired. That guard is what stops a stale or reused link from
-- flipping a decision after the fact.
create or replace function kiosk_respond_quotation(p_quote_id text, p_token text, p_approved boolean)
returns boolean
language plpgsql
security definer
as $$
declare
  cur jsonb;
begin
  select data into cur from quotations where id = p_quote_id;
  if not found then return false; end if;
  if (cur->>'quoteToken') is null or (cur->>'quoteToken') <> p_token then return false; end if;
  if (cur->>'status') <> 'sent' then return false; end if;

  update quotations
    set data = data || jsonb_build_object('status', case when p_approved then 'accepted' else 'rejected' end),
        updated_at = now()
    where id = p_quote_id;
  return true;
end;
$$;
revoke execute on function kiosk_respond_quotation(text, text, boolean) from public;
grant execute on function kiosk_respond_quotation(text, text, boolean) to anon;
grant execute on function kiosk_respond_quotation(text, text, boolean) to authenticated;

-- kiosk_vehicle_history(): full service history for a vehicle, gated on
-- BOTH the plate AND the phone number of the customer it's registered to
-- (unlike kiosk_lookup_job, which only needs a job/plate number) -- a
-- single job status is low-stakes to expose to anyone with the plate
-- number (visible on the car itself), but a full history is more than a
-- stranger walking past the vehicle should be able to pull up.
create or replace function kiosk_vehicle_history(p_plate text, p_phone text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  veh record;
begin
  select v.id, v.data->>'plate' as plate, v.data->>'model' as model, v.data->>'customerId' as customer_id
    into veh
    from vehicles v
    where replace(lower(v.data->>'plate'), ' ', '') = replace(lower(p_plate), ' ', '')
    limit 1;
  if not found then return null; end if;

  if not exists (
    select 1 from customers c
    where c.id = veh.customer_id
      and regexp_replace(coalesce(c.data->>'phone',''), '\D', '', 'g') = regexp_replace(coalesce(p_phone,''), '\D', '', 'g')
      and regexp_replace(coalesce(c.data->>'phone',''), '\D', '', 'g') <> ''
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'plate', veh.plate, 'model', veh.model,
    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'jobNo', j.data->>'jobNo', 'status', j.data->>'status',
        'description', j.data->>'description', 'createdAt', (j.data->>'createdAt')::bigint
      ) order by (j.data->>'createdAt')::bigint desc), '[]'::jsonb)
      from jobs j where j.data->>'vehicleId' = veh.id
    ),
    'invoices', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'invoiceNo', i.data->>'invoiceNo', 'total', (i.data->>'total')::numeric,
        'createdAt', (i.data->>'createdAt')::bigint
      ) order by (i.data->>'createdAt')::bigint desc), '[]'::jsonb)
      from invoices i where i.data->>'vehicleId' = veh.id
    )
  );
end;
$$;
revoke execute on function kiosk_vehicle_history(text, text) from public;
grant execute on function kiosk_vehicle_history(text, text) to anon;
grant execute on function kiosk_vehicle_history(text, text) to authenticated;

-- kiosk_request_appointment(): a public "book a service" form (no login,
-- no existing customer/vehicle record required) files the request as a new
-- Lead (source: online booking) rather than writing straight into
-- `appointments` -- staff already has a working Leads workflow (see
-- leadsTabHTML in src/views/customers.js) to review, call to confirm
-- details, and only then create a real confirmed Appointment. Writing
-- straight into `appointments` would mean an unverified public submission
-- shows up looking exactly like a staff-confirmed booking.
create or replace function kiosk_request_appointment(p_name text, p_phone text, p_plate text, p_date text, p_time text, p_notes text)
returns boolean
language plpgsql
security definer
as $$
declare
  notes text;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    return false;
  end if;
  notes := format('Kenderaan: %s%sTarikh/masa diminta: %s %s%s',
    coalesce(nullif(trim(p_plate), ''), '-'), chr(10),
    coalesce(nullif(trim(p_date), ''), '-'), coalesce(nullif(trim(p_time), ''), ''), chr(10));
  if coalesce(trim(p_notes), '') <> '' then
    notes := notes || chr(10) || trim(p_notes);
  end if;

  insert into leads (id, data, updated_at)
  values (
    gen_random_uuid()::text,
    jsonb_build_object(
      'name', trim(p_name), 'phone', trim(p_phone), 'source', 'Tempahan Dalam Talian',
      'notes', notes, 'status', 'new', 'createdAt', (extract(epoch from now())*1000)::bigint
    ),
    now()
  );
  return true;
end;
$$;
revoke execute on function kiosk_request_appointment(text, text, text, text, text, text) from public;
grant execute on function kiosk_request_appointment(text, text, text, text, text, text) to anon;
grant execute on function kiosk_request_appointment(text, text, text, text, text, text) to authenticated;

-- kiosk_get_invoice(): anonymous-safe receipt view/download, same
-- token-gated pattern as kiosk_get_quotation above. Includes basic shop
-- letterhead fields (shop_meta) since this page has no other way to reach
-- them -- unlike the staff-side print, which already has db.settings loaded.
create or replace function kiosk_get_invoice(p_invoice_id text, p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  rec record;
  shop jsonb;
begin
  select i.data->>'invoiceNo' as invoice_no, i.data->>'invoiceToken' as token,
         i.data->'items' as items, (i.data->>'subtotal')::numeric as subtotal,
         (i.data->>'discount')::numeric as discount, (i.data->>'taxRate')::numeric as tax_rate,
         (i.data->>'tax')::numeric as tax, (i.data->>'total')::numeric as total,
         i.data->>'payment' as payment, (i.data->>'createdAt')::bigint as created_at,
         c.data->>'name' as customer_name, v.data->>'plate' as plate, v.data->>'model' as model
    into rec
    from invoices i
    left join customers c on c.id = i.data->>'customerId'
    left join vehicles v on v.id = i.data->>'vehicleId'
    where i.id = p_invoice_id;

  if not found or rec.token is null or rec.token <> p_token then
    return null;
  end if;

  select data into shop from shop_meta where id = 'settings';

  return jsonb_build_object(
    'invoiceNo', rec.invoice_no, 'items', rec.items, 'subtotal', rec.subtotal,
    'discount', rec.discount, 'taxRate', rec.tax_rate, 'tax', rec.tax, 'total', rec.total,
    'payment', rec.payment, 'createdAt', rec.created_at,
    'customerName', rec.customer_name, 'plate', rec.plate, 'model', rec.model,
    'shopName', shop->>'shopName', 'shopAddress', shop->>'shopAddress', 'shopPhone', shop->>'shopPhone'
  );
end;
$$;
revoke execute on function kiosk_get_invoice(text, text) from public;
grant execute on function kiosk_get_invoice(text, text) to anon;
grant execute on function kiosk_get_invoice(text, text) to authenticated;
