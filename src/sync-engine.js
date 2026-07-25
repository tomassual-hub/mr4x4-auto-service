/* ============================= DATA LAYER ============================= */
let db = null;
let saveTimer = null;
let inactivityTimer = null;
const INACTIVITY_LOCK_MS = 5*60*1000; // auto-lock after 5 minutes of no interaction
function resetInactivityTimer(){
  clearTimeout(inactivityTimer);
  if(!state.currentStaff || state.kioskMode) return;
  inactivityTimer = setTimeout(()=>{
    if(state.currentStaff){
      supabaseClient.auth.signOut();
      unsubscribeRealtime();
      db = defaultDB();
      state.currentStaff = null;
      state.modal = null;
      state.confirmAction = null;
      render();
      showToast(tt('Sesi tamat kerana tidak aktif. Sila log masuk semula.'));
    }
  }, INACTIVITY_LOCK_MS);
}

function defaultDB(){
  return {
    customers: [],
    vehicles: [],
    jobs: [],
    inventory: [],
    invoices: [],
    staff: [],
    appointments: [],
    contracts: [],
    suppliers: [],
    purchaseOrders: [],
    auditLog: [],
    branches: [{id:'main', name:'Cawangan Utama'}],
    cashClosures: [],
    settings: { shopName:'Mr 4x4 Auto Service', shopPhone:'', taxRate:0, loyaltyVisits:5, loyaltyDiscount:10, churnDays:180, simpleMode:false, paymentQR:'', lastBackupAt:null },
    counters: { job: 1, invoice: 1, po: 1 }
  };
}

// ---- Supabase sync engine -------------------------------------------------
// One row-per-record table per top-level db.* array (see backend/schema.sql).
// db itself keeps the exact shape the rest of the app already expects —
// only how it's loaded/saved changes, so none of the ~80 existing
// "mutate db.x then call queueSave()" call sites needed to change.
const TABLE_MAP = {
  customers:'customers', vehicles:'vehicles', jobs:'jobs', inventory:'inventory',
  invoices:'invoices', appointments:'appointments', contracts:'contracts',
  suppliers:'suppliers', purchaseOrders:'purchase_orders', auditLog:'audit_log',
  branches:'branches', cashClosures:'cash_closures'
};
const REVERSE_TABLE_MAP = Object.fromEntries(Object.entries(TABLE_MAP).map(([k,v])=>[v,k]));
let lastSynced = null; // per-table Map(id -> JSON snapshot), set once db is first loaded

function staffDiffKey(rec){
  const {userId, ...rest} = rec;
  return JSON.stringify(rest)+'|'+(userId||'');
}

function snapshotDB(){
  const snap = {};
  for(const key of Object.keys(TABLE_MAP)){
    snap[key] = new Map((db[key]||[]).map(r=>[r.id, JSON.stringify(r)]));
  }
  snap.staff = new Map((db.staff||[]).map(r=>[r.id, staffDiffKey(r)]));
  snap.settings = JSON.stringify(db.settings);
  return snap;
}

// PostgREST (Supabase's REST layer) caps every response at its configured
// max-rows setting (1000 by default) regardless of how many rows actually
// match — an unpaginated `.select()` doesn't error past that point, it just
// silently returns a partial result. For a shop's first year that's
// invisible; a couple of years of invoices/audit-log history in and logins
// would start silently dropping the tail of the oldest (or newest,
// depending on ordering) records with no error anywhere. Page through with
// `.range()` until a page comes back shorter than the page size.
const REMOTE_PAGE_SIZE = 1000;
async function fetchAllRows(table, columns){
  const rows = [];
  let from = 0;
  for(;;){
    const { data, error } = await supabaseClient.from(table).select(columns).range(from, from + REMOTE_PAGE_SIZE - 1);
    if(error) throw error;
    rows.push(...(data||[]));
    if(!data || data.length < REMOTE_PAGE_SIZE) break;
    from += REMOTE_PAGE_SIZE;
  }
  return rows;
}

async function loadRemoteDB(){
  const d = defaultDB();
  const tableEntries = Object.entries(TABLE_MAP);
  // Fire all table fetches in parallel instead of one-at-a-time — with 15
  // separate queries, sequential loading meant several seconds of "Sedang
  // log masuk…" on every login even on a decent connection. Each individual
  // fetch still pages internally via fetchAllRows if that one table is
  // large enough to need it.
  const [tableResults, staffRows, metaRes, counterRows] = await Promise.all([
    Promise.all(tableEntries.map(([key, table]) =>
      fetchAllRows(table, 'id,data')
        .then(data => ({ key, data, error: /** @type {any} */ (null) }))
        .catch(error => ({ key, data: /** @type {any[]} */ ([]), error }))
    )),
    fetchAllRows('staff', 'id,user_id,data'),
    supabaseClient.from('shop_meta').select('data').eq('id','settings').maybeSingle(),
    fetchAllRows('counters', 'name,value'),
  ]);
  for(const r of tableResults){
    if(r.error) throw r.error;
    d[r.key] = (r.data||[]).map(row=>row.data);
  }
  d.staff = staffRows.map(r=>({...r.data, id:r.id, userId:r.user_id}));
  if(metaRes.data && metaRes.data.data) Object.assign(d.settings, metaRes.data.data);
  counterRows.forEach(c=>{ if(d.counters[c.name]!==undefined) d.counters[c.name] = c.value; });
  return d;
}

async function syncListTable(key, table, appendOnly){
  const prevMap = (lastSynced && lastSynced[key]) || new Map();
  const curArr = db[key] || [];
  const curMap = new Map();
  const upserts = [];
  curArr.forEach(r=>{
    const json = JSON.stringify(r);
    curMap.set(r.id, json);
    if(prevMap.get(r.id)!==json) upserts.push({id:r.id, data:r, updated_at:new Date().toISOString()});
  });
  if(upserts.length){ const {error} = await supabaseClient.from(table).upsert(upserts); if(error) throw error; }
  // audit_log is append-only server-side (RLS blocks delete for everyone);
  // the local 300-entry cap is a display trim only, not a cloud deletion.
  if(!appendOnly){
    const deletes = [];
    prevMap.forEach((_,id)=>{ if(!curMap.has(id)) deletes.push(id); });
    if(deletes.length){ const {error} = await supabaseClient.from(table).delete().in('id', deletes); if(error) throw error; }
  }
  return curMap;
}

async function syncStaffTable(){
  const prevMap = (lastSynced && lastSynced.staff) || new Map();
  const curArr = db.staff || [];
  const curMap = new Map();
  const upserts = [];
  curArr.forEach(r=>{
    const json = staffDiffKey(r);
    curMap.set(r.id, json);
    if(prevMap.get(r.id)!==json){
      const {userId, ...rest} = r;
      upserts.push({id:r.id, user_id:userId||null, data:rest, updated_at:new Date().toISOString()});
    }
  });
  const deletes = [];
  prevMap.forEach((_,id)=>{ if(!curMap.has(id)) deletes.push(id); });
  if(upserts.length){ const {error} = await supabaseClient.from('staff').upsert(upserts); if(error) throw error; }
  if(deletes.length){ const {error} = await supabaseClient.from('staff').delete().in('id', deletes); if(error) throw error; }
  return curMap;
}

async function syncSettings(){
  // shop_meta writes are Admin-only server-side (see schema.sql); skipping
  // the call entirely when nothing changed avoids a guaranteed permission
  // error on every single save for non-Admin staff (Mekanik etc.), since
  // this used to run unconditionally regardless of who was saving what.
  const json = JSON.stringify(db.settings);
  const prev = lastSynced && lastSynced.settings;
  if(prev === json) return prev;
  const {error} = await supabaseClient.from('shop_meta').upsert({id:'settings', data:db.settings, updated_at:new Date().toISOString()});
  if(error) throw error;
  return json;
}

let realtimeChannel = null;
function subscribeRealtime(){
  if(realtimeChannel) return;
  realtimeChannel = supabaseClient.channel('shop-sync');
  [...Object.values(TABLE_MAP), 'staff', 'shop_meta'].forEach(table=>{
    realtimeChannel.on('postgres_changes', { event:'*', schema:'public', table }, payload=>handleRemoteChange(table, payload));
  });
  realtimeChannel.subscribe();
}
function unsubscribeRealtime(){
  if(realtimeChannel){ supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
}
function maybeRerender(){
  const active = document.activeElement;
  const typing = active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
  if(state.modal || typing) return; // don't yank an in-progress edit out from under the user
  render();
}
function isRecordOpenInModal(id){
  if(!state.modal) return false;
  for(const k in state.modal){
    const v = state.modal[k];
    if(v && typeof v==='object' && v.id===id) return true;
  }
  return false;
}
function showModalConflictWarning(){
  const modalEl = document.querySelector('.modal');
  if(!modalEl || modalEl.querySelector('.conflict-warning')) return;
  const en = state.language==='en';
  const div = document.createElement('div');
  div.className = 'conflict-warning';
  div.textContent = en
    ? 'Someone else just updated this — saving now may overwrite their change.'
    : 'Rekod ini baru dikemas kini oleh orang lain — menyimpan sekarang mungkin menimpa perubahan mereka.';
  modalEl.insertBefore(div, modalEl.firstChild);
}
function showSettingsConflictWarning(){
  // Settings is a full page, not a modal, so it needs its own target — and
  // unlike record edits, the risk here isn't a skipped re-render (Simpan
  // Tetapan reads straight from the visible inputs either way): it's that
  // clicking Save re-submits every field from this now-stale page load,
  // silently reverting whatever the other Admin just changed remotely.
  const settingsEl = document.getElementById('settings-view');
  if(!settingsEl || settingsEl.querySelector('.conflict-warning')) return;
  const en = state.language==='en';
  const div = document.createElement('div');
  div.className = 'conflict-warning';
  div.style.gridColumn = '1 / -1';
  div.textContent = en
    ? 'Another Admin just changed shop settings. Reload this page before saving, or your Simpan Tetapan click will overwrite their change.'
    : 'Admin lain baru sahaja menukar tetapan kedai. Muat semula halaman ini sebelum menyimpan, jika tidak klik Simpan Tetapan anda akan menimpa perubahan mereka.';
  settingsEl.insertBefore(div, settingsEl.firstChild);
}

function handleRemoteChange(table, payload){
  if(!db) return;
  if(table==='shop_meta'){
    if(payload.new && payload.new.id==='settings'){
      db.settings = payload.new.data;
      if(lastSynced) lastSynced.settings = JSON.stringify(db.settings);
      if(state.view==='settings'){
        // A full render() would rebuild #settings-view from scratch and both
        // wipe the warning we're about to insert AND discard any in-progress
        // (unsaved) edits in the other fields — same reasoning as the
        // modal-open guard in maybeRerender(), just without a state.modal to
        // key off of here since Settings is a full page, not a modal.
        showSettingsConflictWarning();
        return;
      }
    }
    maybeRerender();
    return;
  }
  const key = table==='staff' ? 'staff' : REVERSE_TABLE_MAP[table];
  if(!key) return;
  const arr = db[key] || (db[key]=[]);
  // Supabase sends payload.new as {} (truthy!) on DELETE events, not null —
  // must branch on eventType, not a truthy check on payload.new.
  const id = payload.eventType==='DELETE' ? payload.old.id : payload.new.id;
  const idx = arr.findIndex(r=>r.id===id);
  if(payload.eventType==='DELETE'){
    if(idx>-1) arr.splice(idx,1);
    if(lastSynced && lastSynced[key]) lastSynced[key].delete(id);
  } else {
    const rec = key==='staff' ? {...payload.new.data, id:payload.new.id, userId:payload.new.user_id} : payload.new.data;
    const wasExisting = idx>-1;
    // Merge into the existing object instead of swapping in a new one —
    // any open edit modal is holding a direct reference to this exact
    // record (state.modal.job, etc.), captured via db[key].find(...) when
    // it was opened. Replacing arr[idx] wholesale detaches that reference
    // from the array: the modal keeps editing an orphaned copy, its Save
    // button mutates a field nothing else ever reads, and the edit is lost
    // with no error. This is a real race even on a single device — e.g.
    // creating a job and immediately reopening it before that job's own
    // realtime echo comes back.
    if(idx>-1) Object.assign(arr[idx], rec); else arr.push(rec);
    if(lastSynced && lastSynced[key]) lastSynced[key].set(id, key==='staff' ? staffDiffKey(rec) : JSON.stringify(rec));
    // Someone else just changed a record while this staff member has it open
    // in a modal — warn without a full re-render, which would wipe whatever
    // they're mid-typing (same reasoning as maybeRerender() below).
    if(wasExisting && state.modal && isRecordOpenInModal(id)) showModalConflictWarning();
  }
  maybeRerender();
}

async function allocateCounter(name, prefix, pad){
  try{
    const { data, error } = await supabaseClient.rpc('next_counter', { counter_name: name });
    if(error) throw error;
    db.counters[name] = data;
    return prefix+'-'+String(data).padStart(pad,'0');
  }catch(e){
    reportError(e, 'Counter RPC gagal, guna nombor tempatan');
    const n = ++db.counters[name];
    return prefix+'-'+String(n).padStart(pad,'0');
  }
}
async function nextJobNo(){ return allocateCounter('job','WS',4); }
async function nextInvNo(){ return allocateCounter('invoice','INV',4); }
async function nextPoNo(){ return allocateCounter('po','PO',4); }

async function resolveStaffForUser(user){
  // claim_staff_record() runs server-side (security definer) so this one
  // narrow self-linking operation works even though direct staff table
  // writes are Admin-only — it can only claim a row matching the caller's
  // own verified auth email, or bootstrap Admin if no staff exist yet.
  const { data, error } = await supabaseClient.rpc('claim_staff_record');
  if(error) throw error;
  if(!data) return null;
  return {...data.data, id:data.id, userId:data.user_id};
}

const OFFLINE_CACHE_KEY = 'mr4x4-offline-cache';
function cacheOfflineSnapshot(userId, staffMember, dbSnapshot){
  try{
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ userId, staffMember, db: dbSnapshot, savedAt: Date.now() }));
  }catch(e){ /* storage full/unavailable — offline fallback just won't be there next time */ }
}
function loadOfflineSnapshot(userId){
  try{
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.userId===userId ? parsed : null;
  }catch(e){ return null; }
}

async function handleAuthenticated(session){
  state.authBusy = true; state.loginError=''; render();
  try{
    const staffMember = await resolveStaffForUser(session.user);
    if(!staffMember){
      await supabaseClient.auth.signOut();
      state.authBusy = false;
      state.loginError = state.language==='en'
        ? 'No staff record found for this email. Ask an Admin to add you in Settings → Staff first.'
        : 'Tiada rekod staf untuk e-mel ini. Minta Admin tambah anda di Tetapan → Staf dahulu.';
      render();
      return;
    }
    db = await loadRemoteDB();
    lastSynced = snapshotDB();
    // A brand-new shop's branches table starts empty in Supabase — nothing
    // ever pushes defaultDB()'s starter branch there on its own. Several
    // places (job creation, POS checkout) assume db.branches[0] exists as
    // the fallback "current" branch, so guarantee at least one is present
    // and persist it, rather than crashing the first time anyone uses them.
    // (lastSynced is snapshotted BEFORE this fix is applied, so the debounced
    // queueSave() below correctly sees it as a new row to push, not a no-op.)
    if(!db.branches || db.branches.length===0){
      db.branches = [{id:'main', name:'Cawangan Utama'}];
      queueSave();
    }
    state.currentStaff = staffMember;
    state.authBusy = false;
    state.offlineMode = false;
    identifyStaffForErrorMonitoring(staffMember);
    if(!state.currentBranch) state.currentBranch = 'all';
    subscribeRealtime();
    checkOnboarding();
    cacheOfflineSnapshot(session.user.id, staffMember, db);
    render();
  }catch(e){
    reportError(e, 'Gagal muat data bengkel');
    const cached = loadOfflineSnapshot(session.user.id);
    if(cached){
      db = cached.db;
      lastSynced = snapshotDB();
      state.currentStaff = cached.staffMember;
      state.offlineMode = true;
      state.offlineCacheAt = cached.savedAt;
      state.authBusy = false;
      if(!state.currentBranch) state.currentBranch = 'all';
      render();
      showToast(state.language==='en' ? 'Offline — showing your last saved data. Changes will sync once you\'re back online.' : 'Luar talian — memaparkan data tersimpan terakhir anda. Perubahan akan disegerak apabila anda kembali dalam talian.');
      return;
    }
    state.authBusy = false;
    state.loginError = state.language==='en' ? 'Failed to load shop data. Check your connection and try again.' : 'Gagal muat data bengkel. Semak sambungan anda dan cuba lagi.';
    render();
  }
}

async function initApp(){
  initErrorMonitoring();
  db = defaultDB();
  render();
  try{
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if(session) await handleAuthenticated(session);
  }catch(e){ reportError(e, 'Gagal semak sesi log masuk'); }
  supabaseClient.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
      unsubscribeRealtime();
      db = defaultDB();
      state.currentStaff = null;
      render();
    }
    if(event==='PASSWORD_RECOVERY'){
      // Arrived via a "reset password" email link — Supabase already
      // authenticated this session; make them set a new password before
      // letting them into the app rather than silently loading data.
      state.authMode = 'reset';
      state.loginError = '';
      render();
    }
  });
  // Auto-recover once the browser regains connectivity, instead of
  // requiring a manual page refresh to leave offline (cached-data) mode.
  window.addEventListener('online', async ()=>{
    if(state.offlineMode && state.currentStaff){
      try{
        const { data:{ session } } = await supabaseClient.auth.getSession();
        if(session) await handleAuthenticated(session);
      }catch(e){ /* still offline or another issue — will retry on the next online event */ }
    }
  });
}

function queueSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    state.syncStatus = 'syncing';
    updateSyncIndicator();
    try{
      const newSnap = {};
      for(const [key, table] of Object.entries(TABLE_MAP)){
        newSnap[key] = await syncListTable(key, table, key==='auditLog');
      }
      newSnap.staff = await syncStaffTable();
      newSnap.settings = await syncSettings();
      lastSynced = newSnap;
      state.syncStatus = 'idle';
      updateSyncIndicator();
    }catch(e){
      reportError(e, 'Gagal simpan data');
      state.syncStatus = 'error';
      updateSyncIndicator();
      showToast(state.language==='en' ? 'Sync failed — check your internet connection.' : 'Segerak gagal — semak sambungan internet anda.');
    }
  }, 300);
}

