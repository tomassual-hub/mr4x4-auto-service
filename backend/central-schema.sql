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

-- Credit balance + referral code -- added after pricing was finalized
-- (RM0.00 free / RM50.00 pro). `alter table ... add column if not exists`
-- rather than putting these in the `create table` above, so re-running this
-- whole file against the already-live production project (see header
-- comment) upgrades the existing table in place instead of no-op'ing.
alter table licenses add column if not exists credit_balance numeric not null default 0;
alter table licenses add column if not exists referral_code text unique;
alter table licenses add column if not exists referred_by text references licenses(id);

-- toyyibpay_webhook_secret: a random per-bill value generated when a real
-- ToyyibPay bill is created (see supabase/functions/create-toyyibpay-bill),
-- embedded in that bill's callback URL as a query param and checked back
-- against it in supabase/functions/toyyibpay-webhook. Without this, the
-- webhook only trusted licenseKey+billcode to decide who to upgrade -- both
-- of which the paying shop's own browser already sees in the create-bill
-- response, so anyone could just POST straight to the public webhook URL
-- with their own known licenseKey+billcode and upgrade to Pro for free
-- without ever paying. Nullable -- only real ToyyibPay bills set it; the
-- test-mode-only simulate_upgrade() below doesn't use this at all.
alter table licenses add column if not exists toyyibpay_webhook_secret text;

-- Short, human-shareable code -- deliberately NOT the license key itself
-- (that's a long bearer secret, see src/license.js -- sharing it would let
-- someone else's app impersonate this shop's license). 6 base-36 chars is
-- ~31 bits, plenty at the scale of "shops referring other shops"; the
-- unique constraint above plus the retry loop in assign_referral_code()
-- handle the rare collision rather than assuming one away.
create or replace function generate_referral_code()
returns text
language sql
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

create or replace function assign_referral_code(p_license_key text)
returns text
language plpgsql
as $$
declare
  code text;
  attempt int := 0;
begin
  loop
    code := generate_referral_code();
    begin
      update licenses set referral_code = code where id = p_license_key;
      return code;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then raise; end if;
    end;
  end loop;
end;
$$;

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

  -- Every license gets a referral code eventually -- assigned lazily here
  -- rather than only at insert time, so rows created before this feature
  -- shipped (i.e. this app's own live production shop) still get one on
  -- their next login instead of being stuck with referral_code = null.
  if rec.referral_code is null then
    rec.referral_code := assign_referral_code(rec.id);
  end if;

  -- Auto-expire past due dates here rather than needing a separate cron
  -- job -- every caller always gets a truthful status.
  if rec.expires_at is not null and rec.expires_at < now() and rec.status = 'active' then
    update licenses set status = 'expired', updated_at = now() where id = p_license_key returning * into rec;
  end if;

  return jsonb_build_object('plan', rec.plan, 'status', rec.status, 'expiresAt', rec.expires_at, 'creditBalance', rec.credit_balance, 'referralCode', rec.referral_code);
end;
$$;
revoke execute on function check_license(text, text) from public;
grant execute on function check_license(text, text) to anon;
grant execute on function check_license(text, text) to authenticated;

-- redeem_referral_code(): called once, the first time a shop enters
-- someone else's referral code (see src/license.js). Rewards the REFERRER,
-- not the redeemer -- matches the "credit = bring in another shop, get
-- credit" mechanic decided for this feature. A license can only redeem one
-- referral code ever (guarded by referred_by), so this can't be looped for
-- infinite credit by repeatedly redeeming.
create or replace function redeem_referral_code(p_license_key text, p_referral_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  caller record;
  referrer record;
  reward numeric := 10; -- RM10 per successful referral
begin
  select * into caller from licenses where id = p_license_key;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'unknown_license');
  end if;
  if caller.referred_by is not null then
    return jsonb_build_object('success', false, 'reason', 'already_redeemed');
  end if;

  select * into referrer from licenses where referral_code = upper(trim(p_referral_code));
  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_code');
  end if;
  if referrer.id = p_license_key then
    return jsonb_build_object('success', false, 'reason', 'self_referral');
  end if;

  update licenses set referred_by = referrer.id, updated_at = now() where id = p_license_key;
  update licenses set credit_balance = credit_balance + reward, updated_at = now() where id = referrer.id;

  return jsonb_build_object('success', true, 'reward', reward);
end;
$$;
revoke execute on function redeem_referral_code(text, text) from public;
grant execute on function redeem_referral_code(text, text) to anon;
grant execute on function redeem_referral_code(text, text) to authenticated;

-- redeem_credit_for_upgrade(): spends REAL earned credit (from
-- redeem_referral_code above) to upgrade a plan -- unlike simulate_upgrade()
-- below, this isn't test-mode-gated, since it's backed by credit the shop
-- actually earned by referring another shop, not a payment bypass.
create or replace function redeem_credit_for_upgrade(p_license_key text, p_plan text)
returns jsonb
language plpgsql
security definer
as $$
declare
  rec record;
  price numeric;
begin
  -- Keep in sync with PLAN_PRICE_MYR in src/license.js.
  price := case p_plan when 'pro' then 50 when 'free' then 0 else null end;
  if price is null then
    return jsonb_build_object('success', false, 'reason', 'unknown_plan');
  end if;

  select * into rec from licenses where id = p_license_key;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'unknown_license');
  end if;
  if rec.credit_balance < price then
    return jsonb_build_object('success', false, 'reason', 'insufficient_credit');
  end if;

  update licenses
    set plan = p_plan, status = 'active', expires_at = now() + interval '30 days',
        credit_balance = credit_balance - price, updated_at = now()
    where id = p_license_key
    returning * into rec;

  return jsonb_build_object('success', true, 'plan', rec.plan, 'status', rec.status, 'expiresAt', rec.expires_at, 'creditBalance', rec.credit_balance);
end;
$$;
revoke execute on function redeem_credit_for_upgrade(text, text) from public;
grant execute on function redeem_credit_for_upgrade(text, text) to anon;
grant execute on function redeem_credit_for_upgrade(text, text) to authenticated;

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
