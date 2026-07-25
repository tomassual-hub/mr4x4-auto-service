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
});

/* ============================= INIT ============================= */
initApp();
