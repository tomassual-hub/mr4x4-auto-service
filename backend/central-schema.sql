-- ServisPro Central Licensing Service — a SEPARATE Supabase project from
-- any individual shop's own database (see backend/schema.sql + SETUP.md).
-- Every ServisPro installation is otherwise single-tenant: each shop runs
-- its own isolated Supabase project with full access to its own data. If
-- subscription status lived in that SAME project, a shop could just edit
-- their own row to unlock paid features, which defeats the point of real
-- enforcement. This project is the one thing shops DON'T get dashboard
-- access to — only the developer does. Run this once in a NEW Supabase
-- project's SQL Editor (Dashboard → SQL Editor → New query → Run), not in
-- any shop's existing project.
--
-- After running this, put the new project's URL + anon key into
-- LICENSE_SUPABASE_URL / LICENSE_SUPABASE_ANON_KEY in src/license.js.

create table if not exists licenses (
  id text primary key, -- the license key itself -- generated client-side (see src/license.js) the first time a shop's app checks in, not assigned here
  shop_name text,
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

-- simulate_upgrade(): TEST-MODE STAND-IN for real billing. Upgrades a
-- license immediately with no payment happening at all -- exists purely so
-- the whole plan-page / upgrade / unlock loop can be built and tested
-- before a ToyyibPay account exists. Replace the body of this function
-- with real logic once ToyyibPay is wired up (create a bill, return its
-- URL, and only actually upgrade from a webhook handler after ToyyibPay
-- confirms payment landed) -- or drop it entirely once nothing client-side
-- calls it anymore. DO NOT leave this reachable once real billing exists;
-- as written it's a free, unauthenticated way to grant any plan to any
-- license key.
create or replace function simulate_upgrade(p_license_key text, p_plan text)
returns jsonb
language plpgsql
security definer
as $$
declare
  rec record;
begin
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
