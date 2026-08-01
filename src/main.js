function focusEnd(id){
  const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
  if(!el) return;
  el.focus();
  const supportsSelection = ['text','search','url','tel','password'].includes(el.type);
  if(supportsSelection && el.setSelectionRange){
    try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){ /* ignore unsupported input types */ }
  }
}

function downloadCSV(filename, headers, rows){
  const esc = v => `"${String(v).replace(/"/g,'""')}"`;
  const lines = [headers.map(esc).join(','), ...rows.map(r=>r.map(esc).join(','))];
  const blob = new Blob([lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast(tt('Fail ')+filename+tt(' dimuat turun.'));
}

// Re-entrancy guard: without this, a fast double-click/double-tap on a
// submit-style button (checkout, create-job, save-po, save-credit-note,
// save-quotation, ...) fires the click listener twice before the first
// call's counter RPC (nextInvNo/nextJobNo/...) has even resolved, since
// none of these async handlers disabled their own button — both calls run
// to completion, producing two invoices (with inventory/loyalty deducted
// twice), two job cards, etc. Keyed by action name (+ data-id for
// bindAllAction, since the same action name is reused across many rows'
// buttons and those are independent operations, not duplicates of each
// other) rather than the DOM element itself, so it still works correctly
// even if a handler calls render() — which replaces the element — partway
// through its own async work.
const inFlightActions = new Set();
async function runGuardedAction(key, el, fn){
  if(inFlightActions.has(key)) return;
  inFlightActions.add(key);
  if('disabled' in el) el.disabled = true;
  try{
    await fn();
  } finally {
    inFlightActions.delete(key);
    if('disabled' in el) el.disabled = false;
  }
}
function bindAction(name, fn){
  const el = document.querySelector(`[data-action="${name}"]`);
  if(el) el.addEventListener('click', () => runGuardedAction(name, el, fn));
}
function bindAllAction(name, fn){
  document.querySelectorAll(`[data-action="${name}"]`).forEach(el=>{
    const htmlEl = /** @type {HTMLElement} */ (el);
    htmlEl.addEventListener('click', ()=>runGuardedAction(name+':'+(htmlEl.dataset.id||''), htmlEl, ()=>fn(htmlEl)));
  });
}

// A <div>/<span> with only a 'click' listener (nav items, .clickable links,
// search-result rows, etc.) is invisible to keyboard-only navigation — no
// tab stop, nothing to press Enter/Space on. Rather than retrofitting every
// render function individually, mark anything carrying one of these
// data-* action attributes as focusable/keyboard-activatable in one place,
// called after every render() (see render-core.js) — covers current AND
// future call sites automatically instead of needing to stay in sync.
// Every tab-strip and card-style click target in the app needs its own
// data-* attr listed here -- new ones don't auto-inherit from data-action
// (that name is reserved for actual mutations, not "which tab is active").
// Missed several of these when this list was first written: whole tab
// strips (Appointments/Customers/Inventory x2/Jobs filter/Leads filter/
// Reports range/Staff) and a few "click the whole card" targets (job
// ticket -> detail modal, vehicle -> history modal, inspection checklist
// item, diagram pin) were keyboard-unreachable as a result.
const INTERACTIVE_DATA_ATTRS = ['data-action','data-nav','data-gs-idx','data-notif-nav','data-kiosk-star',
  'data-appttab','data-customertab','data-invmaintab','data-invtab','data-jobfilter','data-leadfilter',
  'data-range','data-stafftab','data-job-detail','data-vehicle-history','data-inspect-item','data-diagram-mark-idx'];
function isCustomInteractiveElement(el){
  if(!el || !el.tagName) return false;
  if(['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(el.tagName)) return false; // already natively focusable/activatable
  return INTERACTIVE_DATA_ATTRS.some(attr => el.hasAttribute(attr));
}
function makeClickablesFocusable(){
  document.querySelectorAll(INTERACTIVE_DATA_ATTRS.map(a=>`[${a}]`).join(',')).forEach(el=>{
    if(!isCustomInteractiveElement(el)) return;
    if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0');
    if(!el.hasAttribute('role')) el.setAttribute('role','button');
  });
}

/* ============================= INIT ============================= */
/* ============================= KEYBOARD SHORTCUTS ============================= */
['mousemove','mousedown','keydown','touchstart','scroll'].forEach(evt=>{
  document.addEventListener(evt, ()=>resetInactivityTimer(), {passive:true});
});
document.addEventListener('keydown', (e)=>{
  if(state.currentStaff && !state.kioskMode && state.view==='pos' && (e.ctrlKey||e.metaKey) && e.key==='Enter'){
    const btn = /** @type {HTMLButtonElement} */ (document.querySelector('[data-action="checkout"]'));
    if(btn && !btn.disabled){ e.preventDefault(); btn.click(); }
  }
  if(isModalBlocking()){
    if(e.key==='Escape'){ e.preventDefault(); closeActiveModalViaEscape(); return; }
    // Trap Tab inside the open modal -- otherwise it cycles through the
    // sidebar/page content sitting behind it (see render-core.js's comment
    // on manageModalFocus for the full rationale).
    if(e.key==='Tab'){
      const focusable = getFocusableInModal();
      if(focusable.length>0){
        const first = focusable[0], last = focusable[focusable.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); /** @type {HTMLElement} */(last).focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); /** @type {HTMLElement} */(first).focus(); }
      }
    }
  }
  // Enter/Space activation for the div/span-based controls made focusable
  // above — matches native <button> semantics: Enter activates on keydown,
  // Space activates on keyup (so holding it down doesn't repeat-fire, and
  // preventDefault here stops the page from scrolling on Space either way).
  const active = /** @type {HTMLElement} */ (document.activeElement);
  if(isCustomInteractiveElement(active)){
    if(e.key==='Enter'){ e.preventDefault(); active.click(); }
    else if(e.key===' '){ e.preventDefault(); }
  }
});
document.addEventListener('keyup', (e)=>{
  const active = /** @type {HTMLElement} */ (document.activeElement);
  if(e.key===' ' && isCustomInteractiveElement(active)){ e.preventDefault(); active.click(); }
});

/* ============================= INIT ============================= */
initApp();
