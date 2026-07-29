/* ============================= DASHBOARD ============================= */
function viewDashboard(){
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
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

  return `
  <div class="grid ${isAdmin?'grid-4':'grid-3'}" style="margin-bottom:22px;">
    ${isAdmin ? `
    <div class="stat-card ok">
      <div class="stat-icon">${ICONS.pos}</div>
      <div class="stat-label">${t('stat_today_sales')}</div>
      <div class="stat-value">${fmtRM(todaySales)}</div>
      <div class="stat-sub">${todaysInvoices.length} invois dikeluarkan</div>
    </div>` : ''}
    <div class="stat-card">
      <div class="stat-icon">${ICONS.jobs}</div>
      <div class="stat-label">${t('stat_active_jobs')}</div>
      <div class="stat-value">${activeJobs.length}</div>
      <div class="stat-sub">${waitingJobs.length} menunggu tindakan</div>
    </div>
    <div class="stat-card ${lowStock.length ? 'warn' : 'ok'}">
      <div class="stat-icon">${ICONS.inventory}</div>
      <div class="stat-label">${t('stat_low_stock')}</div>
      <div class="stat-value">${lowStock.length}</div>
      <div class="stat-sub">item perlu ditambah</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.customers}</div>
      <div class="stat-label">${t('stat_total_customers')}</div>
      <div class="stat-value">${db.customers.length}</div>
      <div class="stat-sub">${db.vehicles.length} kenderaan direkod</div>
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
          <span>${inv.invoiceNo} — ${cust?cust.name:tt('Walk-in')}</span>
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

