function renderSidebar(){
  const lowStockCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;
  const activeJobs = db.jobs.filter(j=>j.status!=='delivered').length;
  let items = [
    {k:'dashboard', l:t('nav_dashboard'), icon:ICONS.dashboard},
    {k:'jobs', l:t('nav_jobs'), icon:ICONS.jobs, badge:activeJobs},
    {k:'pos', l:t('nav_pos'), icon:ICONS.pos},
    {k:'inventory', l:t('nav_inventory'), icon:ICONS.inventory, badge:lowStockCount, badgeWarn:true},
    {k:'customers', l:t('nav_customers'), icon:ICONS.customers},
    {k:'techref', l:state.language==='en'?'Tech Reference':'Rujukan Teknikal', icon:ICONS.book},
    {k:'reports', l:t('nav_reports'), icon:ICONS.reports, adminOnly:true},
    {k:'payroll', l:tt('Gaji'), icon:ICONS.wallet, adminOnly:true},
    {k:'staffpage', l:t('nav_staff'), icon:ICONS.staff, adminOnly:true},
    {k:'appointments', l:t('nav_appointments'), icon:ICONS.calendar, advancedOnly:true},
    {k:'settings', l:t('nav_settings'), icon:ICONS.settings, adminOnly:true},
  ];
  // "adminOnly" here really means "management-level" (Admin or Kerani) --
  // Kerani gets full access to these sections, just not the revenue
  // figures inside them (see dashboard.js/pos.js/appointments.js/reports.js).
  if(!canManage()) items = items.filter(it=>!it.adminOnly);
  if(db.settings.simpleMode) items = items.filter(it=>!it.advancedOnly);
  return `
  <div class="sidebar ${state.navOpen?'nav-open':''}">
    <div class="brand" style="position:relative;text-align:center;">
      <div class="brand-mark" style="justify-content:center;">${logoMarkHtml(58)}</div>
      <div class="brand-sub">${tt('Pakar Servis 4x4')}</div>
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
        <div class="sidebar-account-toggles">
          <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
            <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
            <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
          </div>
          <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
            <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
            <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
          </div>
        </div>
        <div class="sidebar-account-buttons">
          <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
          ${faceIdSupportedSync() ? `<button class="btn-icon" data-action="open-faceid-settings" title="Face ID">${ICONS.faceid}</button>` : ''}
          <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
        </div>
      </div>
    </div>
    <div class="sidebar-foot">${t('sidebar_foot')}</div>
  </div>`;
}

// Self-service 2FA (TOTP) management — reachable by EVERY staff member
// (Mekanik included), unlike the rest of Settings which is Admin-only, so
// this lives in its own modal rather than inside the Settings view.
function mfaSettingsModalHTML(){
  const en = state.language==='en';
  const verifiedFactor = (state.mfaFactors||[]).find(f=>f.status==='verified');

  if(state.mfaEnrollment){
    const { qrSvg, secret } = state.mfaEnrollment;
    return `
      <h2>${ICONS.settings} ${en?'Set Up 2FA':'Sediakan 2FA'}</h2>
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Scan this with Google Authenticator, Authy, or any TOTP app.':'Imbas ini dengan Google Authenticator, Authy, atau apa-apa aplikasi TOTP.'}</p>
      <div style="background:#fff;padding:14px;border-radius:8px;width:fit-content;margin:0 auto 14px;"><img src="${esc(qrSvg)}" width="200" height="200" alt="QR 2FA"></div>
      <p style="font-size:11px;color:var(--text-muted);text-align:center;word-break:break-all;">${en?'Or enter manually:':'Atau masukkan manual:'} <code>${esc(secret)}</code></p>
      <div class="field"><label>${en?'6-digit code':'Kod 6 digit'}</label><input id="mfa-enroll-code" inputmode="numeric" maxlength="6" placeholder="000000" style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:18px;letter-spacing:6px;"></div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-action="cancel-mfa-enroll">${t('btn_cancel')}</button>
        <button class="btn btn-primary" data-action="confirm-mfa-enroll">${en?'Activate':'Aktifkan'}</button>
      </div>
    `;
  }

  if(verifiedFactor){
    return `
      <h2>${ICONS.settings} ${en?'Two-Factor Authentication (2FA)':'Pengesahan Dua Faktor (2FA)'}</h2>
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,165,121,.12);border-radius:8px;padding:12px;margin-bottom:16px;">
        <span style="color:var(--success);">${ICONS.done}</span>
        <span style="font-size:13px;">${en?'2FA is active on your account.':'2FA aktif pada akaun anda.'}</span>
      </div>
      <p style="font-size:11.5px;color:var(--text-muted);">${en?'If you lose your authenticator device, ask your shop Admin to remove 2FA for you via the Supabase dashboard.':'Jika anda kehilangan peranti authenticator, minta Admin bengkel buang 2FA untuk anda melalui dashboard Supabase.'}</p>
      <div class="modal-foot">
        <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
        <button class="btn btn-danger" data-action="unenroll-mfa" data-id="${verifiedFactor.id}">${en?'Remove 2FA':'Buang 2FA'}</button>
      </div>
    `;
  }

  return `
    <h2>${ICONS.settings} ${en?'Two-Factor Authentication (2FA)':'Pengesahan Dua Faktor (2FA)'}</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Add an extra layer of security — after your password, you\'ll also need a code from an authenticator app to log in.':'Tambah satu lapisan keselamatan — selepas kata laluan, anda juga perlukan kod dari aplikasi authenticator untuk log masuk.'}</p>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="start-mfa-enroll">${en?'Set Up 2FA':'Sediakan 2FA'}</button>
    </div>
  `;
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
  const titles = {dashboard:t('title_dashboard'), jobs:t('title_jobs'), pos:t('title_pos'), inventory:t('title_inventory'), customers:t('title_customers'), reports:t('title_reports'), staffpage:t('title_staffpage'), appointments:t('title_appointments'), settings:t('title_settings'), payroll:t('title_payroll'), techref: state.language==='en'?'Technical Reference':'Rujukan Teknikal'};
  const en = state.language==='en';
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
        ${results.length===0 ? `<div class="gs-empty">${en?`No matches for "${esc(q)}".`:`Tiada padanan untuk "${esc(q)}".`}</div>` : results.map((r,idx)=>`
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
        <option value="all" ${state.currentBranch==='all'?'selected':''}>${en?'All Branches':'Semua Cawangan'}</option>
        ${db.branches.map(b=>`<option value="${b.id}" ${state.currentBranch===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}
      </select>` : ''}      <div class="notif-wrap">
        <button class="btn-icon" data-action="toggle-notif" title="${en?'Notifications':'Notifikasi'}" style="position:relative;">
          ${ICONS.bell}
          ${(()=>{ const n = getNotifications(); return n.length>0 ? `<span class="notif-badge">${n.length}</span>` : ''; })()}
        </button>
        ${state.notifOpen ? `
        <div class="global-search-results" style="width:300px;right:0;left:auto;">
          ${(()=>{
            const n = getNotifications();
            if(n.length===0) return `<div class="gs-empty">${en?'No new notifications.':'Tiada notifikasi baharu.'}</div>`;
            return n.map(item=>`
              <div class="gs-item" data-notif-nav="${item.view}">
                <div class="gs-type" style="background:${item.urgent?'rgba(225,75,75,.18)':'var(--panel-alt)'};color:${item.urgent?'var(--danger)':'var(--text-muted)'};">${item.tag}</div>
                <div><div class="gs-label">${esc(item.label)}</div><div class="gs-sub">${esc(item.sub)}</div></div>
              </div>`).join('');
          })()}
        </div>` : ''}
      </div>
      <div class="topbar-account">
        <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
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
        <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
        <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
      </div>
    </div>
  </div>`;
}

function getNotifications(){
  const out = [];
  const now = Date.now();
  const en = state.language==='en';
  const lowStock = db.inventory.filter(i=>i.qty<=i.lowStock);
  if(lowStock.length>0) out.push({tag:en?'Stock':'Stok', label:lowStock.length+(en?' item(s) low on stock':' item stok rendah'), sub:lowStock.slice(0,3).map(i=>i.name).join(', '), view:'inventory', urgent:true});
  const todayStr = localDateStr();
  const todayAppts = db.appointments.filter(a=>a.status==='scheduled' && a.date===todayStr);
  if(todayAppts.length>0) out.push({tag:en?'Appointments':'Tempahan', label:todayAppts.length+(en?' appointment(s) today':' tempahan hari ini'), sub:todayAppts.map(a=>a.time).join(', '), view:'appointments', urgent:false});
  const overdueContracts = db.contracts.filter(c=>c.nextDue<=now);
  if(overdueContracts.length>0) out.push({tag:en?'Contracts':'Kontrak', label:overdueContracts.length+(en?' overdue contract(s)':' kontrak tertunggak'), sub:overdueContracts.map(c=>c.label).join(', '), view:'appointments', urgent:true});
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
  const has2fa = (state.mfaFactors||[]).some(f=>f.status==='verified');
  if(state.mfaFactors!==null && !has2fa){
    const en = state.language==='en';
    out.push({
      tag: '2FA',
      label: en?'2FA not set up':'2FA belum disediakan',
      sub: en?'Add an extra layer of security to your account.':'Tambah satu lapisan keselamatan pada akaun anda.',
      view:'mfa-settings', urgent:false
    });
  }
  return out;
}

function globalSearchResults(q){
  const ql = q.toLowerCase();
  const en = state.language==='en';
  const out = [];
  db.customers.forEach(c=>{
    if(c.name.toLowerCase().includes(ql) || (c.phone||'').includes(ql)){
      out.push({typeLabel:en?'Customer':'Pelanggan', label:c.name, sub:c.phone||'-', action:{type:'customer', id:c.id}});
    }
  });
  db.vehicles.forEach(v=>{
    if(v.plate.toLowerCase().includes(ql)){
      const c = getCustomer(v.customerId);
      out.push({typeLabel:en?'Vehicle':'Kenderaan', label:v.plate, sub:(v.model||'')+' · '+(c?c.name:'-'), action:{type:'vehicle', id:v.id}});
    }
  });
  db.jobs.forEach(j=>{
    if(j.jobNo.toLowerCase().includes(ql)){
      const v = getVehicle(j.vehicleId);
      out.push({typeLabel:en?'Job Card':'Kad Kerja', label:j.jobNo, sub:v?v.plate:'-', action:{type:'job', id:j.id}});
    }
  });
  db.invoices.forEach(inv=>{
    if(inv.invoiceNo.toLowerCase().includes(ql)){
      const c = getCustomer(inv.customerId);
      out.push({typeLabel:en?'Invoice':'Invois', label:inv.invoiceNo, sub:(c?c.name:'Walk-in')+' · '+fmtRM(inv.total), action:{type:'invoice', id:inv.id}});
    }
  });
  return out.slice(0,8);
}

function renderView(){
  const adminOnlyViews = ['reports','staffpage','settings','payroll'];
  if(adminOnlyViews.includes(state.view) && !canManage()){
    const en = state.language==='en';
    return `<div class="panel" style="text-align:center;padding:50px 20px;">
      ${ICONS.alert}
      <h2 style="margin-top:14px;">${en?'Access Restricted':'Akses Terhad'}</h2>
      <p style="color:var(--text-muted);font-size:13px;">${en?'This section is for Admin/Kerani roles only. Please contact your shop admin.':'Bahagian ini hanya untuk staf peranan Admin/Kerani. Sila hubungi admin bengkel anda.'}</p>
    </div>`;
  }
  switch(state.view){
    case 'dashboard': return viewDashboard();
    case 'jobs': return viewJobs();
    case 'pos': return viewPOS();
    case 'inventory': return viewInventory();
    case 'customers': return viewCustomers();
    case 'techref': return viewTechRef();
    case 'reports': return viewReports();
    case 'payroll': return viewPayroll();
    case 'staffpage': return viewStaff();
    case 'appointments': return viewAppointments();
    case 'settings': return viewSettings();
    default: return '';
  }
}

