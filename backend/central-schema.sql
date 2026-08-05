-- ServisPro Central Licensing Service — lives in the developer's own
-- Supabase project, not any individual shop's. Every ServisPro
-- installation is otherwise single-tenant: each shop runs its own
-- isolated Supabase project with full access to its own data. If
-- subscription status lived in THAT project, a shop could just edit their
-- own row to unlock paid features, which defeats the point of real
-- enforcement.
--
-- Currently co-located in this shop's own PRODUCTION project (free-tier
-- project limit reached when trying to spin up a dedicated third one) --
-- still safe: `revoke all ... from anon, authenticated` below means even
-- this shop's own staff, despite having full access to every other table
-- in this same project, cannot read/write the licenses table directly at
-- all, only through the two narrow RPCs further down. If a fully separate
-- project is ever created later (paid plan, or freeing up a slot), this
-- file can just be re-run there unchanged and LICENSE_SUPABASE_URL/
-- ANON_KEY in src/license.js repointed -- nothing here assumes which
-- project it lives in.
--
-- Run in Supabase Dashboard → SQL Editor → New query → Run. After running,
-- put this project's URL + anon key into LICENSE_SUPABASE_URL /
-- LICENSE_SUPABASE_ANON_KEY in src/license.js (same values already used
-- for SUPABASE_URL/SUPABASE_ANON_KEY in build/build.js, since it's the
-- same project).

create table if not exists licenses (
  id text primary key check (length(id) between 16 and 100), -- the license key itself -- generated client-side (see src/license.js) the first time a shop's app checks in, not assigned here
  shop_name text check (length(shop_name) <= 200),
  plan text not null default 'free',
  status text not null default 'active', -- active | expired | cancelled
  expires_at timestamptz, -- null = doesn't expire (the free plan)
  toyyibpay_bill_code text, -- populated once real billing replaces simulate_upgrade() below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table licenses enable row level security;
-- No direct table grants to anon/authenticated at all -- every read/write
-- goes through the narrow security-definer RPCs below, so a shop's app can
-- only ever affect its OWN license row in the ways these functions allow,
-- never read or touch anyone else's.
revoke all on licenses from anon, authenticated;

-- check_license(): called on every login (see src/license.js). Self-
-- registers a brand new license key on its first-ever call (defaults to
-- the free plan) -- there's no separate "sign up" step before a shop can
-- start using the free tier.
create or replace function check_license(p_license_key text, p_shop_name text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  rec record;
begin
  select * into rec from licenses where id = p_license_key;
  if not found then
    insert into licenses(id, shop_name, plan, status)
    values (p_license_key, p_shop_name, 'free', 'active')
    returning * into rec;
  elsif p_shop_name is not null and rec.shop_name is distinct from p_shop_name then
    update licenses set shop_name = p_shop_name, updated_at = now() where id = p_license_key returning * into rec;
  end if;

  -- Auto-expire past due dates here rather than needing a separate cron
  -- job -- every caller always gets a truthful status.
  if rec.expires_at is not null and rec.expires_at < now() and rec.status = 'active' then
    update licenses set status = 'expired', updated_at = now() where id = p_license_key returning * into rec;
  end if;

  return jsonb_build_object('plan', rec.plan, 'status', rec.status, 'expiresAt', rec.expires_at);
end;
$$;
revoke execute on function check_license(text, text) from public;
grant execute on function check_license(text, text) to anon;
grant execute on function check_license(text, text) to authenticated;

-- license_config: a single-row kill switch for simulate_upgrade() below.
-- Anyone who has the (publicly embedded, by design) anon key can already
-- call simulate_upgrade() directly -- e.g. via curl -- and grant themselves
-- any plan for free, same as this app's own developer did once already
-- while verifying this system works. That's fine while nothing real is
-- gated behind a paid plan yet (see PLAN_FEATURES.free in src/license.js),
-- but becomes a real revenue-bypass the moment something IS gated. Flip
-- this one flag to false the moment real billing exists, from the SQL
-- Editor directly:
--   update license_config set test_mode = false;
-- -- no app redeploy needed, and simulate_upgrade() stops working for
-- everyone (including the developer) immediately.
create table if not exists license_config (
  id text primary key default 'singleton',
  test_mode boolean not null default true
);
alter table license_config enable row level security;
revoke all on license_config from anon, authenticated;
insert into license_config (id, test_mode) values ('singleton', true) on conflict (id) do nothing;

-- simulate_upgrade(): TEST-MODE STAND-IN for real billing. Upgrades a
-- license immediately with no payment happening at all -- exists purely so
-- the whole plan-page / upgrade / unlock loop can be built and tested
-- before a ToyyibPay account exists. Replace the body of this function
-- with real logic once ToyyibPay is wired up (create a bill, return its
-- URL, and only actually upgrade from a webhook handler after ToyyibPay
-- confirms payment landed) -- or drop it entirely once nothing client-side
-- calls it anymore. Gated on license_config.test_mode (see above) so it
-- can be killed instantly without a code change once that matters.
create or replace function simulate_upgrade(p_license_key text, p_plan text)
returns jsonb
language plpgsql
security definer
as $$
declare
  rec record;
  test_mode_on boolean;
begin
  select test_mode into test_mode_on from license_config where id = 'singleton';
  if not coalesce(test_mode_on, false) then
    return null;
  end if;

  update licenses
    set plan = p_plan, status = 'active', expires_at = now() + interval '30 days', updated_at = now()
    where id = p_license_key
    returning * into rec;
  if not found then
    return null;
  end if;
  return jsonb_build_object('plan', rec.plan, 'status', rec.status, 'expiresAt', rec.expires_at);
end;
$$;
revoke execute on function simulate_upgrade(text, text) from public;
grant execute on function simulate_upgrade(text, text) to anon;
grant execute on function simulate_upgrade(text, text) to authenticated;
