function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
// toISOString() always converts to UTC first — in Malaysia (UTC+8) that
// silently shifts the date back by one for anywhere between midnight and
// 8am local, so "today" comparisons against local-date strings (like
// appointment.date or a cash closure's date key) can compare against
// yesterday for the first 8 hours of every day. Build the date string from
// local getFullYear/getMonth/getDate instead.
function localDateStr(d){ d = d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// render() builds the entire UI as HTML strings and injects them via
// innerHTML — any user-entered field (customer name, job notes, item names,
// etc.) landing in one of those strings unescaped is a stored-XSS hole: a
// crafted name/note is then executed in every other logged-in staff
// member's browser (including Admin) the moment they view that record,
// since sync is realtime across devices. Wrap every such field with esc().
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtRM(n){ return 'RM ' + (Number(n)||0).toFixed(2); }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('ms-MY',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtDateTime(ts){ const d=new Date(ts); return d.toLocaleDateString('ms-MY',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'}); }
function logAudit(action, detail){
  db.auditLog.unshift({id:uid(), ts:Date.now(), staff: state.currentStaff?state.currentStaff.name:'?', action, detail});
  if(db.auditLog.length>300) db.auditLog.length = 300;
}

function getCustomer(id){ return db.customers.find(c=>c.id===id); }
function getVehicle(id){ return db.vehicles.find(v=>v.id===id); }
function getVehiclesFor(customerId){ return db.vehicles.filter(v=>v.customerId===customerId); }
function getItem(id){ return db.inventory.find(i=>i.id===id); }
// Shared by the vehicle detail modal (customers.js) and the dashboard's
// "vehicles due for service" panel — kept as one function so the two never
// drift into disagreeing about what "due" means.
function vehicleServiceStatus(v){
  if(!v.serviceIntervalKm) return null;
  const nextKm = (v.lastServiceKm||0) + v.serviceIntervalKm;
  const kmLeft = nextKm - (v.odometer||0);
  return { due: kmLeft<=0, kmLeft };
}
function normalizePhone(phone){
  let p = (phone||'').replace(/[^0-9]/g,'');
  if(p.startsWith('0')) p = '6'+p; // Malaysia country code
  return p;
}

// Two separate permission questions, kept as two functions rather than one
// "isAdmin" so a role can answer them differently: Kerani gets full
// Admin-level access to Reports/Staff/Settings/Payroll (canManage) but is
// excluded from actual sales/revenue figures (canSeeRevenue) -- Admin is
// the only role where both are true. Mekanik/Ketua Mekanik are both false
// for everything (handled by the existing role==='Admin' checks that were
// already scoped to hide revenue from them, now reused via canSeeRevenue).
function canManage(){
  const role = state.currentStaff && state.currentStaff.role;
  return role==='Admin' || role==='Kerani';
}
function canSeeRevenue(){
  return !!(state.currentStaff && state.currentStaff.role==='Admin');
}

// LOGO_DATA_URI is a flat-gold silhouette (logo shape + transparency, no
// shading), so a plain <img> pins it to one fixed color regardless of theme.
// Rendering it as a CSS mask instead lets background-color:var(--accent)
// drive its color, so it automatically switches shade with the rest of the
// UI's accent (gold in dark mode, deeper amber in light mode) instead of
// staying stuck at one hardcoded tone.
function logoMarkHtml(px){
  return `<div role="img" aria-label="Mr 4x4 Auto Service" style="display:inline-block;height:${px}px;aspect-ratio:200/211;background-color:var(--accent);-webkit-mask:url(${LOGO_DATA_URI}) center / contain no-repeat;mask:url(${LOGO_DATA_URI}) center / contain no-repeat;"></div>`;
}

