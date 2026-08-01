/* ============================= DASHBOARD ============================= */
function viewDashboard(){
  const en = state.language==='en';
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayStr = localDateStr();
  const branchFilter = rec => state.currentBranch==='all' || rec.branchId===state.currentBranch || (!rec.branchId && state.currentBranch==='main');
  const todaysInvoices = db.invoices.filter(inv=>inv.createdAt>=todayStart.getTime() && branchFilter(inv));
  const todaySales = todaysInvoices.reduce((s,i)=>s+i.total,0);
  const activeJobs = db.jobs.filter(j=>j.status!=='delivered' && branchFilter(j));
  const waitingJobs = db.jobs.filter(j=>j.status==='waiting');
  const lowStock = db.inventory.filter(i=>i.qty<=i.lowStock);
  const recentInvoices = [...db.invoices].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  // Sales figures (today's total, recent invoice amounts) are Admin-only —
  // Mekanik still sees everything else (active jobs, stock, customer count).
  const isAdmin = state.currentStaff && state.currentStaff.role==='Admin';

  const bookingsToday = db.appointments.filter(a=>a.date===todayStr).length;
  const completedToday = db.jobs.filter(j=>(j.status==='done'||j.status==='delivered') && j.doneAt && localDateStr(new Date(j.doneAt))===todayStr).length;
  const staffCount = db.staff.length;
  const presentToday = db.staff.filter(s=>{
    const todaysPunches = (db.attendance||[]).filter(a=>a.staffId===s.id && localDateStr(new Date(a.ts))===todayStr).sort((a,b)=>b.ts-a.ts);
    return todaysPunches[0] && todaysPunches[0].type==='in';
  }).length;

  // Workshop's own step-by-step process (customer -> vehicle -> job sheet ->
  // parts/labour -> invoice/payment -> history/follow-up), grouped into the
  // 4 pages that actually exist rather than 6 separate destinations -- "Add
  // Vehicle Profile" lives inside Customers and "Add Parts/Labour/Expenses"
  // lives inside a job's own detail modal, neither has its own page, so
  // pretending otherwise would just be a dead link. Visible to every role
  // (not gated by isAdmin) since none of this is revenue data.
  const workflowSteps = [
    { nav:'customers', icon:ICONS.customers,
      title: en?'1. Register Customer & Vehicle':'1. Daftar Pelanggan & Kenderaan',
      desc: en?'Create a customer record and log their vehicle details':'Cipta rekod pelanggan dan catat butiran kenderaan' },
    { nav:'jobs', icon:ICONS.jobs,
      title: en?'2. Open Job Sheet & Add Parts':'2. Buka Kad Kerja & Tambah Alat Ganti',
      desc: en?'Start a job card, then log parts, labour and expenses as work happens':'Mulakan kad kerja, catat alat ganti, kerja dan perbelanjaan' },
    { nav:'pos', icon:ICONS.pos,
      title: en?'3. Quote, Invoice & Payment':'3. Sebut Harga, Invois & Bayaran',
      desc: en?'Turn the job into an invoice and record how the customer paid':'Tukar kerja kepada invois dan rekod cara pelanggan bayar' },
    { nav:'customers', icon:ICONS.history,
      title: en?'4. Service History & Follow-Up':'4. Sejarah Servis & Susulan',
      desc: en?"Every job saves to the vehicle's history — remind customers when due":'Setiap kerja disimpan dalam sejarah kenderaan — ingatkan pelanggan bila perlu' },
  ];

  return `
  <div class="panel" style="margin-bottom:22px;text-align:center;padding:26px 20px;">
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;">
      <div style="height:44px;">${logoMarkHtml(44)}</div>
      <div style="font-family:'Oswald',sans-serif;font-weight:700;font-size:34px;letter-spacing:-.5px;color:var(--accent);">ServisPro</div>
    </div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px;">${en?'Workspace':'Ruang Kerja'}: <strong style="color:var(--text);">${esc(db.settings.shopName)}</strong></div>
  </div>

  <div class="panel" style="margin-bottom:22px;">
    <h2>${ICONS.repeat} ${en?'Workshop Workflow':'Aliran Kerja Bengkel'}</h2>
    <div class="grid grid-4" style="gap:12px;">
      ${workflowSteps.map(s=>`
        <div class="stat-card" style="cursor:pointer;" data-nav="${s.nav}">
          <div class="stat-icon">${s.icon}</div>
          <div class="stat-label" style="text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:700;color:var(--text);">${s.title}</div>
          <div class="stat-sub">${s.desc}</div>
        </div>`).join('')}
    </div>
  </div>

  ${isAdmin ? `
  <div class="panel dash-hero" style="margin-bottom:22px;">
    <div class="stat-label">${esc(db.settings.shopName)} · ${t('stat_today_sales')}</div>
    <div class="dash-hero-value">${fmtRM(todaySales)}</div>
    <div class="stat-sub">${todaysInvoices.length} ${tt('invois dikeluarkan')}</div>
  </div>` : ''}

  ${isAdmin ? `
  <div class="panel" style="margin-bottom:22px;">
    <h2>${ICONS.reports} ${en?'Sales Trend (Last 30 Days)':'Trend Jualan (30 Hari Lepas)'}</h2>
    ${renderSalesChart(db.invoices.filter(branchFilter), 30)}
  </div>` : ''}

  ${isAdmin && (db.settings.monthlySalesTarget>0 || db.settings.monthlyUnitTarget>0) ? (()=>{
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
    <div class="panel" style="margin-bottom:22px;">
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
        </div>` : ''}
        ${monthUnitTarget>0 ? `
        <div style="text-align:center;">
          <div class="progress-ring" style="--pct:${unitPct};margin:0 auto 10px;">
            <div class="progress-ring-label"><div class="progress-ring-pct">${unitPct}%</div><div class="progress-ring-sub">${en?'Units':'Unit'}</div></div>
          </div>
          <div style="font-size:12.5px;font-weight:600;">${actualUnits} / ${unitTarget.toFixed(0)} ${en?'invoices':'invois'}</div>
        </div>` : ''}
      </div>
    </div>`;
  })() : ''}

  <div class="grid grid-3" style="margin-bottom:22px;">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.calendar}</div>
      <div class="stat-label">${en?'Bookings Today':'Tempahan Hari Ini'}</div>
      <div class="stat-value">${bookingsToday}</div>
      <div class="stat-sub">${en?'appointments scheduled':'tempahan dijadualkan'}</div>
    </div>
    <div class="stat-card ok">
      <div class="stat-icon">${ICONS.done}</div>
      <div class="stat-label">${en?'Completed Today':'Selesai Hari Ini'}</div>
      <div class="stat-value">${completedToday}</div>
      <div class="stat-sub">${en?'job cards marked ready/delivered':'kad kerja siap/dihantar'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.staff}</div>
      <div class="stat-label">${en?'Attendance Today':'Kehadiran Hari Ini'}</div>
      <div class="stat-value">${presentToday}/${staffCount}</div>
      <div class="stat-sub">${en?'staff clocked in':'staf clock in'}</div>
    </div>
  </div>

  <div class="grid grid-3" style="margin-bottom:22px;">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.jobs}</div>
      <div class="stat-label">${t('stat_active_jobs')}</div>
      <div class="stat-value">${activeJobs.length}</div>
      <div class="stat-sub">${waitingJobs.length} ${tt('menunggu tindakan')}</div>
    </div>
    <div class="stat-card ${lowStock.length ? 'warn' : 'ok'}">
      <div class="stat-icon">${ICONS.inventory}</div>
      <div class="stat-label">${t('stat_low_stock')}</div>
      <div class="stat-value">${lowStock.length}</div>
      <div class="stat-sub">${tt('item perlu ditambah')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.customers}</div>
      <div class="stat-label">${t('stat_total_customers')}</div>
      <div class="stat-value">${db.customers.length}</div>
      <div class="stat-sub">${db.vehicles.length} ${tt('kenderaan direkod')}</div>
    </div>
  </div>

  <div class="grid grid-2">
    <div class="panel">
      <h2>${tt('Kad Kerja Aktif')} <span class="tag">${activeJobs.length}</span></h2>
      ${activeJobs.length===0 ? emptyState(tt('Tiada kerja aktif buat masa ini.')) : `
      <div class="tickets">${activeJobs.slice(0,4).map(renderJobTicket).join('')}</div>`}
      ${activeJobs.length>0 ? `<div style="margin-top:14px;"><span class="btn btn-outline btn-sm" data-nav="jobs">${tt('Lihat Semua Kad Kerja')}</span></div>` : ''}
    </div>
    <div class="panel">
      <h2>${ICONS.reports} ${tt('Amaran Stok Rendah')}</h2>
      ${lowStock.length===0 ? emptyState(tt('Semua stok mencukupi.')) : lowStock.map(i=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dashed var(--border);">
          <div>
            <div style="font-weight:600;font-size:13px;">${esc(i.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${esc(i.sku)}</div>
          </div>
          <span class="pill pill-low">${i.qty} ${tt('baki')}</span>
        </div>`).join('')}
      ${isAdmin ? `
      <h2 style="margin-top:22px;">${tt('Invois Terkini')}</h2>
      ${recentInvoices.length===0 ? emptyState(tt('Belum ada invois.')) : recentInvoices.map(inv=>{
        const cust = getCustomer(inv.customerId);
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">
          <span>${inv.invoiceNo} — ${cust?esc(cust.name):tt('Walk-in')}</span>
          <span style="font-family:'IBM Plex Mono',monospace;color:var(--accent);">${fmtRM(inv.total)}</span>
        </div>`;
      }).join('')}` : ''}
    </div>
  </div>

  ${(()=>{
    const now = Date.now();
    const upcomingAppts = db.appointments.filter(a=>a.status==='scheduled' && (a.date+'T'+a.time) >= new Date().toISOString().slice(0,16)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4);
    const overdueContracts = db.contracts.filter(c=>c.nextDue<=now);
    if(upcomingAppts.length===0 && overdueContracts.length===0) return '';
    return `
    <div class="grid grid-2" style="margin-top:20px;">
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
  `;
}

function emptyState(msg){
  return `<div class="empty">${ICONS.wrench}<div>${msg}</div></div>`;
}

