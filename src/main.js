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

function bindAction(name, fn){
  const el = document.querySelector(`[data-action="${name}"]`);
  if(el) el.addEventListener('click', fn);
}
function bindAllAction(name, fn){
  document.querySelectorAll(`[data-action="${name}"]`).forEach(el=>el.addEventListener('click', ()=>fn(el)));
}

// A <div>/<span> with only a 'click' listener (nav items, .clickable links,
// search-result rows, etc.) is invisible to keyboard-only navigation — no
// tab stop, nothing to press Enter/Space on. Rather than retrofitting every
// render function individually, mark anything carrying one of these
// data-* action attributes as focusable/keyboard-activatable in one place,
// called after every render() (see render-core.js) — covers current AND
// future call sites automatically instead of needing to stay in sync.
const INTERACTIVE_DATA_ATTRS = ['data-action','data-nav','data-gs-idx','data-notif-nav','data-kiosk-star'];
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
