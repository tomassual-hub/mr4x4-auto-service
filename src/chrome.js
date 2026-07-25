function renderSidebar(){
  const lowStockCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;
  const activeJobs = db.jobs.filter(j=>j.status!=='delivered').length;
  const isAdmin = state.currentStaff && state.currentStaff.role==='Admin';
  let items = [
    {k:'dashboard', l:t('nav_dashboard'), icon:ICONS.dashboard},
    {k:'jobs', l:t('nav_jobs'), icon:ICONS.jobs, badge:activeJobs},
    {k:'pos', l:t('nav_pos'), icon:ICONS.pos},
    {k:'inventory', l:t('nav_inventory'), icon:ICONS.inventory, badge:lowStockCount, badgeWarn:true},
    {k:'customers', l:t('nav_customers'), icon:ICONS.customers},
    {k:'reports', l:t('nav_reports'), icon:ICONS.reports, adminOnly:true},
    {k:'staffpage', l:t('nav_staff'), icon:ICONS.staff, adminOnly:true},
    {k:'appointments', l:t('nav_appointments'), icon:ICONS.calendar, advancedOnly:true},
    {k:'settings', l:t('nav_settings'), icon:ICONS.settings, adminOnly:true},
  ];
  if(!isAdmin) items = items.filter(it=>!it.adminOnly);
  if(db.settings.simpleMode) items = items.filter(it=>!it.advancedOnly);
  return `
  <div class="sidebar ${state.navOpen?'nav-open':''}">
    <div class="brand" style="position:relative;text-align:center;">
      <div class="brand-mark" style="justify-content:center;"><img src="${LOGO_DATA_URI}" alt="Mr 4x4 Auto Service" style="height:58px;width:auto;display:block;margin:0 auto;"></div>
      <div class="brand-sub">Pakar Servis 4x4</div>
      <button class="btn-icon hamburger-btn" data-action="close-nav" style="position:absolute;top:0;right:0;">${ICONS.x}</button>
    </div>
    <div class="nav">
      ${items.map(it=>`
        <div class="nav-item ${state.view===it.k?'active':''}" data-nav="${it.k}">
          ${it.icon}<span>${it.l}</span>
          ${it.badge ? `<span class="nav-badge" style="${it.badgeWarn && it.badge>0 ? 'background:var(--danger);color:#fff;':''}">${it.badge}</span>` : ''}
        </div>`).join('')}
    </div>
    <div class="sidebar-account-mobile">
      <div class="sidebar-account-row">
        <div class="user-avatar">${initials(state.currentStaff?state.currentStaff.name:'')}</div>
        <div>
          <div class="staff-name">${state.currentStaff?state.currentStaff.name:''}</div>
          <div class="staff-role">${state.currentStaff?state.currentStaff.role:''}</div>
        </div>
      </div>
      <div class="sidebar-account-actions">
        <div class="theme-toggle" data-action="toggle-theme" title="Tukar tema">
          <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
          <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
        </div>
        <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
          <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
          <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
        </div>
        <button class="btn-icon" data-action="logout" title="${t('btn_logout')}" style="margin-left:auto;">${ICONS.logout}</button>
      </div>
    </div>
    <div class="sidebar-foot">${t('sidebar_foot')}</div>
  </div>`;
}

function syncIndicatorClass(){
  if(state.offlineMode) return 'offline';
  return state.syncStatus==='syncing' ? 'syncing' : state.syncStatus==='error' ? 'error' : 'idle';
}
function syncIndicatorLabel(){
  const en = state.language==='en';
  if(state.offlineMode) return en?'Offline — showing last saved data':'Luar talian — memaparkan data tersimpan terakhir';
  if(state.syncStatus==='syncing') return en?'Syncing…':'Sedang menyegerak…';
  if(state.syncStatus==='error') return en?'Sync failed — check your connection':'Segerak gagal — semak sambungan';
  return en?'Synced':'Disegerak';
}
function updateSyncIndicator(){
  const el = document.getElementById('sync-indicator');
  if(!el) return;
  el.className = 'sync-indicator ' + syncIndicatorClass();
  el.title = syncIndicatorLabel();
}

function renderTopbar(){
  const titles = {dashboard:t('title_dashboard'), jobs:t('title_jobs'), pos:t('title_pos'), inventory:t('title_inventory'), customers:t('title_customers'), reports:t('title_reports'), staffpage:t('title_staffpage'), appointments:t('title_appointments'), settings:t('title_settings')};
  const s = state.currentStaff;
  const q = state.globalSearch||'';
  const results = q.trim() ? globalSearchResults(q.trim()) : [];
  return `
  <div class="topbar">
    <div class="topbar-left">
      <button class="btn-icon hamburger-btn" data-action="open-nav">${ICONS.menu}</button>
      <div style="min-width:0;">
        <h1>${titles[state.view]}</h1>
        <div class="date" style="margin-top:2px;">${new Date().toLocaleDateString('ms-MY',{weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</div>
      </div>
    </div>
    <div class="global-search-wrap">
      <div class="search-box" style="margin-bottom:0;">${ICONS.search}<input id="global-search" placeholder="${t('search_placeholder')}" value="${esc(q)}"></div>
      ${q.trim() ? `
      <div class="global-search-results">
        ${results.length===0 ? `<div class="gs-empty">Tiada padanan untuk "${esc(q)}".</div>` : results.map((r,idx)=>`
          <div class="gs-item" data-gs-idx="${idx}">
            <div class="gs-type">${esc(r.typeLabel)}</div>
            <div>
              <div class="gs-label">${esc(r.label)}</div>
              <div class="gs-sub">${esc(r.sub)}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    </div>
    <div class="user-badge">
      <div id="sync-indicator" class="sync-indicator ${syncIndicatorClass()}" title="${syncIndicatorLabel()}"><span class="sync-dot"></span></div>
      ${db.branches.length>1 ? `
      <select id="branch-selector" style="width:auto;padding:8px 10px;font-size:12px;">
        <option value="all" ${state.currentBranch==='all'?'selected':''}>Semua Cawangan</option>
        ${db.branches.map(b=>`<option value="${b.id}" ${state.currentBranch===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}
      </select>` : ''}      <div class="notif-wrap">
        <button class="btn-icon" data-action="toggle-notif" title="Notifikasi" style="position:relative;">
          ${ICONS.bell}
          ${(()=>{ const n = getNotifications(); return n.length>0 ? `<span class="notif-badge">${n.length}</span>` : ''; })()}
        </button>
        ${state.notifOpen ? `
        <div class="global-search-results" style="width:300px;right:0;left:auto;">
          ${(()=>{
            const n = getNotifications();
            if(n.length===0) return `<div class="gs-empty">Tiada notifikasi baharu.</div>`;
            return n.map(item=>`
              <div class="gs-item" data-notif-nav="${item.view}">
                <div class="gs-type" style="background:${item.urgent?'rgba(225,75,75,.18)':'var(--panel-alt)'};color:${item.urgent?'var(--danger)':'var(--text-muted)'};">${item.tag}</div>
                <div><div class="gs-label">${esc(item.label)}</div><div class="gs-sub">${esc(item.sub)}</div></div>
              </div>`).join('');
          })()}
        </div>` : ''}
      </div>
      <div class="topbar-account">
        <div class="theme-toggle" data-action="toggle-theme" title="Tukar tema">
          <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
          <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
        </div>
        <div>
          <div class="user-name" style="text-align:right;">${s?s.name:''}</div>
          <div class="user-role" style="text-align:right;">${s?s.role:''}</div>
        </div>
        <div class="user-avatar">${initials(s?s.name:'')}</div>
        <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
          <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
          <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
        </div>
        <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
      </div>
    </div>
  </div>`;
}

function getNotifications(){
  const out = [];
  const now = Date.now();
  const lowStock = db.inventory.filter(i=>i.qty<=i.lowStock);
  if(lowStock.length>0) out.push({tag:'Stok', label:lowStock.length+' item stok rendah', sub:lowStock.slice(0,3).map(i=>i.name).join(', '), view:'inventory', urgent:true});
  const todayStr = localDateStr();
  const todayAppts = db.appointments.filter(a=>a.status==='scheduled' && a.date===todayStr);
  if(todayAppts.length>0) out.push({tag:'Tempahan', label:todayAppts.length+' tempahan hari ini', sub:todayAppts.map(a=>a.time).join(', '), view:'appointments', urgent:false});
  const overdueContracts = db.contracts.filter(c=>c.nextDue<=now);
  if(overdueContracts.length>0) out.push({tag:'Kontrak', label:overdueContracts.length+' kontrak tertunggak', sub:overdueContracts.map(c=>c.label).join(', '), view:'appointments', urgent:true});
  const sizeBytes = JSON.stringify(db).length;
  const sizeMB = sizeBytes/1024/1024;
  if(sizeMB >= 4){
    const en = state.language==='en';
    out.push({
      tag: en?'Storage':'Storan',
      label: en?`Data is ${sizeMB.toFixed(1)}MB (limit ~5MB)`:`Data sudah ${sizeMB.toFixed(1)}MB (had ~5MB)`,
      sub: en?'Delete old photos or export/archive old invoices soon.':'Padam gambar lama atau eksport/arkibkan invois lama tidak lama lagi.',
      view:'settings', urgent:true
    });
  }
  const lastBackup = db.settings.lastBackupAt;
  const daysSinceBackup = lastBackup ? Math.floor((now-lastBackup)/86400000) : null;
  if(!lastBackup || daysSinceBackup>=7){
    const en = state.language==='en';
    out.push({
      tag: en?'Backup':'Sandaran',
      label: !lastBackup ? (en?'No backup yet':'Belum pernah disandarkan') : (en?`Last backup ${daysSinceBackup} day(s) ago`:`Sandaran terakhir ${daysSinceBackup} hari lalu`),
      sub: en?'Download a backup from Settings to avoid losing data.':'Muat turun sandaran dari Tetapan untuk elak kehilangan data.',
      view:'settings', urgent: !lastBackup || daysSinceBackup>=14
    });
  }
  return out;
}

function globalSearchResults(q){
  const ql = q.toLowerCase();
  const out = [];
  db.customers.forEach(c=>{
    if(c.name.toLowerCase().includes(ql) || (c.phone||'').includes(ql)){
      out.push({typeLabel:'Pelanggan', label:c.name, sub:c.phone||'-', action:{type:'customer', id:c.id}});
    }
  });
  db.vehicles.forEach(v=>{
    if(v.plate.toLowerCase().includes(ql)){
      const c = getCustomer(v.customerId);
      out.push({typeLabel:'Kenderaan', label:v.plate, sub:(v.model||'')+' · '+(c?c.name:'-'), action:{type:'vehicle', id:v.id}});
    }
  });
  db.jobs.forEach(j=>{
    if(j.jobNo.toLowerCase().includes(ql)){
      const v = getVehicle(j.vehicleId);
      out.push({typeLabel:'Kad Kerja', label:j.jobNo, sub:v?v.plate:'-', action:{type:'job', id:j.id}});
    }
  });
  db.invoices.forEach(inv=>{
    if(inv.invoiceNo.toLowerCase().includes(ql)){
      const c = getCustomer(inv.customerId);
      out.push({typeLabel:'Invois', label:inv.invoiceNo, sub:(c?c.name:'Walk-in')+' · '+fmtRM(inv.total), action:{type:'invoice', id:inv.id}});
    }
  });
  return out.slice(0,8);
}

function renderView(){
  const isAdmin = state.currentStaff && state.currentStaff.role==='Admin';
  const adminOnlyViews = ['reports','staffpage','settings'];
  if(adminOnlyViews.includes(state.view) && !isAdmin){
    return `<div class="panel" style="text-align:center;padding:50px 20px;">
      ${ICONS.alert}
      <h2 style="margin-top:14px;">Akses Terhad</h2>
      <p style="color:var(--text-muted);font-size:13px;">Bahagian ini hanya untuk staf peranan Admin. Sila hubungi admin bengkel anda.</p>
    </div>`;
  }
  switch(state.view){
    case 'dashboard': return viewDashboard();
    case 'jobs': return viewJobs();
    case 'pos': return viewPOS();
    case 'inventory': return viewInventory();
    case 'customers': return viewCustomers();
    case 'reports': return viewReports();
    case 'staffpage': return viewStaff();
    case 'appointments': return viewAppointments();
    case 'settings': return viewSettings();
    default: return '';
  }
}

