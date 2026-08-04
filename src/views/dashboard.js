/* ============================= DASHBOARD ============================= */
function viewDashboard(){
  const en = state.language==='en';
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayStr = localDateStr();
  const branchFilter = rec => state.currentBranch==='all' || rec.branchId===state.currentBranch || (!rec.branchId && state.currentBranch==='main');
  const todaysInvoices = db.invoices.filter(inv=>inv.createdAt>=todayStart.getTime() && branchFilter(inv));
  const todaySales = todaysInvoices.reduce((s,i)=>s+i.total,0);
  const activeJobs = db.jobs.filter(j=>j.status!=='delivered' && branchFilter(j));
  const lowStock = db.inventory.filter(i=>i.qty<=i.lowStock);
  // Sales figures (today's total, recent invoice amounts) are Admin-only —
  // Mekanik still sees everything else (active jobs, stock, customer count).
  const isAdmin = canSeeRevenue();

  const bookingsToday = db.appointments.filter(a=>a.date===todayStr).length;
  const completedToday = db.jobs.filter(j=>(j.status==='done'||j.status==='delivered') && j.doneAt && localDateStr(new Date(j.doneAt))===todayStr).length;
  const staffCount = db.staff.length;
  const presentToday = db.staff.filter(s=>{
    const todaysPunches = (db.attendance||[]).filter(a=>a.staffId===s.id && localDateStr(new Date(a.ts))===todayStr).sort((a,b)=>b.ts-a.ts);
    return todaysPunches[0] && todaysPunches[0].type==='in';
  }).length;

  return `
  <div class="dashboard-view">
  ${isAdmin ? `
  <div class="panel dash-hero" style="margin-bottom:22px;">
    ${renderNotifBell('hero-notif')}
    <div class="dash-hero-brand">ServisPro</div>
    <div class="stat-label">${esc(db.settings.shopName)} · ${t('stat_today_sales')}</div>
    <div class="dash-hero-value">${fmtRM(todaySales)}</div>
    <div class="stat-sub">${todaysInvoices.length} ${tt('invois dikeluarkan')}</div>
  </div>` : ''}

  ${isAdmin ? (()=>{
    const period = state.dashTargetPeriod || 'weekly';
    const monthKey = currentMonthStr();
    const monthInvoices = db.invoices.filter(inv=>{
      const d = new Date(inv.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===monthKey;
    });
    // Monday-start week, matching the calendar grid's own week convention
    // (see appointments.js's startWeekday) rather than the locale default.
    const now = new Date();
    const weekStart = new Date(now); weekStart.setHours(0,0,0,0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay()+6)%7));
    const weekInvoices = db.invoices.filter(inv=>inv.createdAt>=weekStart.getTime());
    const monthSalesTarget = db.settings.monthlySalesTarget||0;
    const monthUnitTarget = db.settings.monthlyUnitTarget||0;
    // A calendar month averages ~4.345 weeks -- prorated, not a separately
    // configured weekly figure, so there's only one target number to set.
    const salesTarget = period==='weekly' ? monthSalesTarget/4.345 : monthSalesTarget;
    const unitTarget = period==='weekly' ? monthUnitTarget/4.345 : monthUnitTarget;
    const actualSales = period==='weekly' ? weekInvoices.reduce((s,i)=>s+i.total,0) : monthInvoices.reduce((s,i)=>s+i.total,0);
    const actualUnits = period==='weekly' ? weekInvoices.length : monthInvoices.length;
    const salesPct = salesTarget>0 ? Math.min(100, Math.round(actualSales/salesTarget*100)) : 0;
    const unitPct = unitTarget>0 ? Math.min(100, Math.round(actualUnits/unitTarget*100)) : 0;
    return `
    <div class="panel dash-target-panel" style="margin-bottom:22px;">
      <div class="section-head">
        <h2 style="margin:0;">${ICONS.reports} ${en?'Target':'Sasaran'} <span class="tag">${period==='weekly' ? (en?'This Week':'Minggu Ini') : monthLabel(monthKey)}</span></h2>
        <div class="pill-toggle">
          <span class="pill-toggle-opt ${period==='weekly'?'active':''}" data-action="dash-target-period" data-period="weekly">${en?'Weekly':'Mingguan'}</span>
          <span class="pill-toggle-opt ${period==='monthly'?'active':''}" data-action="dash-target-period" data-period="monthly">${en?'Monthly':'Bulanan'}</span>
        </div>
      </div>
      <div style="display:flex;gap:28px;flex-wrap:wrap;align-items:center;justify-content:center;">
        ${monthSalesTarget>0 ? `
        <div style="text-align:center;">
          <div class="progress-ring" style="--pct:${salesPct};margin:0 auto 10px;">
            <div class="progress-ring-label"><div class="progress-ring-pct">${salesPct}%</div><div class="progress-ring-sub">${en?'Sales':'Jualan'}</div></div>
          </div>
          <div style="font-size:12.5px;font-weight:600;">${fmtRM(actualSales)} / ${fmtRM(salesTarget)}</div>
        </div>` : `
        <div style="text-align:center;">
          <div class="progress-ring progress-ring-locked" style="margin:0 auto 10px;">
            <div class="progress-ring-label">${ICONS.lock}<div class="progress-ring-sub">${en?'Sales':'Jualan'}</div></div>
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);">${en?'Not set':'Belum ditetapkan'}</div>
        </div>`}
        ${monthUnitTarget>0 ? `
        <div style="text-align:center;">
          <div class="progress-ring" style="--pct:${unitPct};margin:0 auto 10px;">
            <div class="progress-ring-label"><div class="progress-ring-pct">${unitPct}%</div><div class="progress-ring-sub">${en?'Units':'Unit'}</div></div>
          </div>
          <div style="font-size:12.5px;font-weight:600;">${actualUnits} / ${unitTarget.toFixed(0)} ${en?'invoices':'invois'}</div>
        </div>` : `
        <div style="text-align:center;">
          <div class="progress-ring progress-ring-locked" style="margin:0 auto 10px;">
            <div class="progress-ring-label">${ICONS.lock}<div class="progress-ring-sub">${en?'Units':'Unit'}</div></div>
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);">${en?'Not set':'Belum ditetapkan'}</div>
        </div>`}
      </div>
      ${monthSalesTarget===0 && monthUnitTarget===0 && canManage() ? `
      <div style="text-align:center;margin-top:16px;">
        <span class="btn btn-outline btn-sm" data-nav="settings">${en?'Set a target in Settings':'Tetapkan sasaran dalam Tetapan'}</span>
      </div>` : ''}
    </div>`;
  })() : ''}

  <div class="grid dash-quickstats" style="margin-bottom:22px;">
    ${dashTile(ICONS.calendar, bookingsToday, en?'Bookings Today':'Tempahan Hari Ini')}
    ${dashTile(ICONS.done, completedToday, en?'Completed Today':'Selesai Hari Ini')}
    ${dashTile(ICONS.staff, `${presentToday}/${staffCount}`, en?'Attendance Today':'Kehadiran Hari Ini')}
    ${dashTile(ICONS.jobs, activeJobs.length, t('stat_active_jobs'))}
    ${dashTile(ICONS.inventory, lowStock.length, t('stat_low_stock'))}
    ${dashTile(ICONS.customers, db.customers.length, t('stat_total_customers'))}
  </div>

  ${(()=>{
    const now = Date.now();
    const upcomingAppts = db.appointments.filter(a=>a.status==='scheduled' && (a.date+'T'+a.time) >= new Date().toISOString().slice(0,16)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4);
    const overdueContracts = db.contracts.filter(c=>c.nextDue<=now);
    if(upcomingAppts.length===0 && overdueContracts.length===0) return '';
    return `
    <div class="grid grid-2 dash-split" style="margin-top:20px;">
      <div class="panel">
        <h2>${ICONS.calendar} ${tt('Tempahan Akan Datang')} <span class="tag">${upcomingAppts.length}</span></h2>
        ${upcomingAppts.length===0 ? emptyState(tt('Tiada tempahan dijadualkan.')) : upcomingAppts.map(a=>{
          const c = getCustomer(a.customerId); const v = getVehicle(a.vehicleId);
          return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">
            <span>${c?esc(c.name):'-'} ${v?'· '+esc(v.plate):''}</span>
            <span style="font-family:'IBM Plex Mono',monospace;color:var(--text-muted);">${a.date} ${a.time}</span>
          </div>`;
        }).join('')}
        ${upcomingAppts.length>0 ? `<div style="margin-top:14px;"><span class="btn btn-outline btn-sm" data-nav="appointments">${tt('Lihat Semua Tempahan')}</span></div>` : ''}
      </div>
      <div class="panel">
        <h2>${ICONS.repeat} ${tt('Kontrak Servis Tertunggak')} <span class="tag">${overdueContracts.length}</span></h2>
        ${overdueContracts.length===0 ? emptyState(tt('Tiada kontrak tertunggak.')) : overdueContracts.map(ct=>{
          const c = getCustomer(ct.customerId);
          return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">
            <span>${esc(ct.label)} ${c?'· '+esc(c.name):''}</span>
            <span class="pill pill-low">${tt('Sejak')} ${fmtDate(ct.nextDue)}</span>
          </div>`;
        }).join('')}
        ${overdueContracts.length>0 ? `<div style="margin-top:14px;"><span class="btn btn-outline btn-sm" data-nav="appointments">${tt('Urus Kontrak')}</span></div>` : ''}
      </div>
    </div>`;
  })()}
  ${(()=>{
    const en = state.language==='en';
    // Overdue-by-mileage vehicles, previously only visible one-by-one by
    // opening each vehicle's own detail modal — nothing surfaced them
    // proactively for outreach. True unattended auto-send isn't possible
    // through wa.me links (that's just a pre-filled compose screen, not a
    // send API), so this at least turns "open every vehicle to check" into
    // "one glance, one tap per customer".
    const dueVehicles = db.vehicles
      .map(v=>({ v, status: vehicleServiceStatus(v) }))
      .filter(x=>x.status && x.status.due)
      .sort((a,b)=>a.status.kmLeft-b.status.kmLeft)
      .slice(0,8);
    if(dueVehicles.length===0) return '';
    return `
    <div class="panel" style="margin-top:20px;">
      <h2>${ICONS.gauge} ${en?'Vehicles Due for Service':'Kenderaan Perlu Servis'} <span class="tag">${dueVehicles.length}</span></h2>
      ${dueVehicles.map(({v, status})=>{
        const c = getCustomer(v.customerId);
        const waText = encodeURIComponent(`Salam ${c?c.name:''}, peringatan mesra dari ${db.settings.shopName} — kenderaan anda ${v.plate} kini ${Math.abs(status.kmLeft).toLocaleString()} km lepas jadual servis. Jemput hubungi kami untuk tempahan.`);
        const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">
          <span>${esc(v.plate)} ${c?'· '+esc(c.name):''} <span style="color:var(--danger);">(${Math.abs(status.kmLeft).toLocaleString()} km ${en?'overdue':'tertunggak'})</span></span>
          ${waHref ? `<a class="btn btn-outline btn-sm" href="${waHref}" target="_blank" rel="noopener">${ICONS.whatsapp} ${en?'Remind':'Ingatkan'}</a>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  })()}
  </div>
  `;
}

function emptyState(msg){
  return `<div class="empty">${ICONS.wrench}<div>${msg}</div></div>`;
}

// Vivid brand-colored tile for the dashboard's "today at a glance" row --
// icon+number share a header row rather than stacking (see .stat-tile in
// styles.css), matching the reference mobile layout the user shared. Kept
// as its own component rather than reusing .stat-card, whose vertical
// icon/label/value stack is a deliberately different shape used everywhere
// else in the app (Jobs, Inventory, etc.) that this change isn't meant to touch.
function dashTile(icon, value, label){
  return `
  <div class="stat-tile">
    <div class="stat-tile-top">
      <div class="stat-tile-icon">${icon}</div>
      <div class="stat-tile-value">${value}</div>
    </div>
    <div class="stat-tile-label">${label}</div>
  </div>`;
}

