/* ============================= LICENSE / SUBSCRIPTION =============================
   Checks this shop's subscription plan against a SEPARATE, developer-owned
   Supabase project (see backend/central-schema.sql) -- not this shop's own
   database, since a shop with dashboard access to its own project could
   otherwise just edit its own row to unlock paid features.

   TEST MODE right now: LICENSE_SUPABASE_URL/ANON_KEY are unset because that
   central project doesn't exist yet, and upgradePlanTestMode() calls
   simulate_upgrade() (no real payment, see that function's own comment in
   central-schema.sql) rather than a real ToyyibPay checkout. Until the
   central project exists, getLicenseClient() returns null and every shop
   is simply treated as the free plan with every feature gate open -- this
   never locks a real shop out of their own data over infrastructure that
   isn't live yet.

   Fails open on a network error too, using the last successful check
   cached in localStorage (see loadCachedLicense/cacheLicense) rather than
   the live result -- a shop with a paid plan shouldn't lose access just
   because this one extra network call timed out.
*/
const LICENSE_SUPABASE_URL = ''; // TODO: fill in once the central project (backend/central-schema.sql) exists
const LICENSE_SUPABASE_ANON_KEY = ''; // TODO: same
const LICENSE_CACHE_KEY = 'bk_license-cache';
const LICENSE_CACHE_MAX_AGE_MS = 7*24*60*60*1000; // stale cache still wins over "assume free" for a week of no connectivity

// Placeholder tiers/pricing -- nobody has actually decided what ServisPro's
// paid plan costs or includes yet (see the conversation this shipped in).
// Gates exactly one real feature (Reports) as a demonstration of the
// mechanism; change PLAN_FEATURES/PLAN_LABELS freely, nothing else needs
// to change shape.
const PLAN_FEATURES = {
  free: ['core'],
  pro: ['core', 'reports'],
};
const PLAN_LABELS = {
  free: { ms:'Percuma', en:'Free', price: 'RM0' },
  pro: { ms:'Pro', en:'Pro', price: 'RM49/bulan' },
};

let licenseClient = null;
function getLicenseClient(){
  if(!LICENSE_SUPABASE_URL || !LICENSE_SUPABASE_ANON_KEY) return null;
  if(!licenseClient) licenseClient = window.supabase.createClient(LICENSE_SUPABASE_URL, LICENSE_SUPABASE_ANON_KEY);
  return licenseClient;
}

// A shop's own license key -- generated once, stored in shop_meta like any
// other setting (synced across every device the shop uses), not tied to
// any individual staff member.
function getOrCreateLicenseKey(){
  if(!db.settings.licenseKey){
    db.settings.licenseKey = uid();
    queueSave();
  }
  return db.settings.licenseKey;
}

function loadCachedLicense(){
  try{
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    if(!raw) return null;
    const cached = JSON.parse(raw);
    if(Date.now() - cached.checkedAt > LICENSE_CACHE_MAX_AGE_MS) return null;
    return cached;
  }catch(e){ return null; }
}
function cacheLicense(license){
  try{ localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(license)); }catch(e){ /* storage full/unavailable -- just skip caching */ }
}

// Called once per login (see handleAuthenticated in sync-engine.js) --
// fire-and-forget, same as maybeAutoBackup() there, so a slow/unreachable
// license check never delays getting into the actual app.
async function checkLicenseStatus(){
  const client = getLicenseClient();
  if(!client){
    state.license = { plan:'free', status:'active', expiresAt:null, checkedAt:Date.now(), live:false };
    render();
    return;
  }
  try{
    const key = getOrCreateLicenseKey();
    const { data, error } = await client.rpc('check_license', { p_license_key:key, p_shop_name:db.settings.shopName||null });
    if(error) throw error;
    state.license = { plan:data.plan, status:data.status, expiresAt:data.expiresAt, checkedAt:Date.now(), live:true };
    cacheLicense(state.license);
  }catch(e){
    reportError(e, 'Gagal semak status langganan');
    const cached = loadCachedLicense();
    state.license = cached || { plan:'free', status:'active', expiresAt:null, checkedAt:Date.now(), live:false };
  }
  render();
}

// TEST MODE ONLY -- see simulate_upgrade()'s own comment in
// central-schema.sql. Upgrades immediately, no payment involved.
async function upgradePlanTestMode(plan){
  const client = getLicenseClient();
  const en = state.language==='en';
  if(!client){
    showToast(en ? 'Central licensing isn\'t set up yet -- ask the developer to finish backend/central-schema.sql.' : 'Sistem langganan pusat belum disediakan -- minta pembangun siapkan backend/central-schema.sql.');
    return;
  }
  try{
    const key = getOrCreateLicenseKey();
    const { data, error } = await client.rpc('simulate_upgrade', { p_license_key:key, p_plan:plan });
    if(error) throw error;
    state.license = { plan:data.plan, status:data.status, expiresAt:data.expiresAt, checkedAt:Date.now(), live:true };
    cacheLicense(state.license);
    showToast(en ? `Upgraded to ${PLAN_LABELS[plan] ? PLAN_LABELS[plan].en : plan} (test mode -- no real payment made).` : `Dinaik taraf ke ${PLAN_LABELS[plan] ? PLAN_LABELS[plan].ms : plan} (mod ujian -- tiada bayaran sebenar).`);
    render();
  }catch(e){
    reportError(e, 'Gagal naik taraf pelan');
    showToast(en ? 'Could not upgrade — try again.' : 'Gagal naik taraf — cuba lagi.');
  }
}

function currentPlan(){
  return (state.license && state.license.plan) || 'free';
}
function hasFeature(key){
  // No central licensing project configured yet at all (see the TODOs on
  // LICENSE_SUPABASE_URL/KEY above) -- nothing is enforced, full stop.
  // "Not configured" must never fall through to "assume the most
  // restrictive plan", or shipping this gate would instantly lock every
  // existing shop (including this app's own real production shop) out of
  // a feature they already had, over infrastructure that doesn't exist
  // yet. Gating only starts actually restricting anything once
  // getLicenseClient() has real credentials to check against.
  if(!getLicenseClient()) return true;
  const plan = currentPlan();
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.free;
  return features.includes(key);
}

function planPickerModalHTML(){
  const en = state.language==='en';
  const plan = currentPlan();
  const testMode = !getLicenseClient();
  return `
  <h2>${ICONS.star} ${en?'Subscription':'Langganan'}</h2>
  ${testMode ? `<div class="conflict-warning">${en?'Test mode — central licensing service not connected yet, everything runs on the free plan.':'Mod ujian — perkhidmatan langganan pusat belum disambung, semua berjalan pada pelan percuma.'}</div>` : ''}
  <div style="display:flex;flex-direction:column;gap:12px;">
    ${Object.keys(PLAN_LABELS).map(key=>{
      const label = PLAN_LABELS[key];
      const isCurrent = plan===key;
      return `
      <div class="panel" style="${isCurrent?'border-color:var(--accent);':''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:700;font-size:15px;">${en?label.en:label.ms}</span>
          ${isCurrent ? `<span class="tag">${en?'Current plan':'Pelan semasa'}</span>` : ''}
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">${label.price}</div>
        ${!isCurrent ? `<button class="btn btn-primary btn-sm" data-action="upgrade-plan-test" data-plan="${key}">${en?'Switch (test mode)':'Tukar (mod ujian)'}</button>` : ''}
      </div>`;
    }).join('')}
  </div>
  <div class="modal-foot">
    <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
  </div>
  `;
}
