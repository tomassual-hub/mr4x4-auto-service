/* ============================= CUSTOMERS VIEW ============================= */
function viewCustomers(){
  const tab = state.customerTab || 'customers';
  return `
  <div class="tabs">
    <div class="tab-btn ${tab==='customers'?'active':''}" data-customertab="customers">${ICONS.customers} ${tt('Pelanggan')}</div>
    <div class="tab-btn ${tab==='leads'?'active':''}" data-customertab="leads">${ICONS.userPlus} ${state.language==='en'?'Leads':'Prospek'}</div>
  </div>
  ${tab==='customers' ? customersTabHTML() : leadsTabHTML()}
  `;
}

function customersTabHTML(){
  const q = (state.customerSearch||'').toLowerCase();
  let customers = db.customers;
  if(q){
    customers = customers.filter(c=>{
      const vs = getVehiclesFor(c.id);
      return c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || vs.some(v=>v.plate.toLowerCase().includes(q));
    });
  }
  const totalCustomers = customers.length;
  const shownCustomers = customers.slice(0, state.customersShowCount||30);
  return `
  <div class="section-head">
    <div><div class="sub">${tt('Rekod pelanggan dan kenderaan mereka')}</div></div>
    <button class="btn btn-primary" data-action="new-customer">${ICONS.plus} ${tt('Pelanggan Baharu')}</button>
  </div>
  <div class="search-box" style="max-width:340px;">${ICONS.search}<input id="customer-search" placeholder="${tt('Cari nama, telefon atau no. plat...')}" value="${esc(state.customerSearch||'')}"></div>
  ${shownCustomers.length===0 ? emptyState(tt('Tiada pelanggan sepadan.')) : `
  <div class="grid grid-3">
    ${shownCustomers.map(c=>{
      const vs = getVehiclesFor(c.id);
      const jobCount = db.jobs.filter(j=>j.customerId===c.id).length;
      return `
      <div class="panel">
        <h2 style="flex-wrap:wrap;">
          <span style="flex:1;min-width:120px;">${esc(c.name)}</span>
          <button class="btn-icon" data-action="edit-customer" data-id="${c.id}">${ICONS.edit}</button>
          <button class="btn-icon" data-action="delete-customer" data-id="${c.id}">${ICONS.trash}</button>
        </h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;">📞 ${esc(c.phone||'-')}  ·  ${jobCount} ${tt('rekod kerja')}</div>
        ${vs.map(v=>`
          <div class="clickable" data-vehicle-history="${v.id}" style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px dashed var(--border);">
            <div>
              <div style="font-weight:600;font-size:13px;">${ICONS.car} ${esc(v.plate)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">${esc(v.model)} · ${esc(v.color)}</div>
            </div>
            <button class="btn-icon" data-action="edit-vehicle" data-id="${v.id}" title="Sunting kenderaan" onclick="event.stopPropagation()">${ICONS.edit}</button>
          </div>`).join('')}
        <button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%;" data-action="add-vehicle" data-id="${c.id}">${ICONS.plus} ${tt('Tambah Kenderaan')}</button>
      </div>`;
    }).join('')}
  </div>
  ${totalCustomers > shownCustomers.length ? `<div style="text-align:center;margin-top:18px;">
    <button class="btn btn-outline" data-action="load-more-customers">${state.language==='en'?'Load More':'Muat Lagi'} (${shownCustomers.length}/${totalCustomers})</button>
  </div>` : ''}`}
  `;
}

/* ---------- WORKSHOP CRM: LEADS / PIPELINE ---------- */
// Tracks prospects who haven't had a job/invoice yet -- separate from
// db.customers (which is only ever people who've actually been served).
// A lead becomes a real customer explicitly via "Tukar kepada Pelanggan",
// never automatically, so the shop stays in control of when a prospect
// actually counts as a customer.
const LEAD_STAGES = ['new','contacted','quoted','won','lost'];
function leadStageLabel(stage){
  const en = state.language==='en';
  return {
    new: en?'New':'Baharu', contacted: en?'Contacted':'Dihubungi',
    quoted: en?'Quoted':'Disebut Harga', won: en?'Won':'Menang', lost: en?'Lost':'Hilang',
  }[stage] || stage;
}
function leadStagePill(stage){
  const cls = stage==='won' ? 'pill-done' : stage==='lost' ? 'pill-low' : stage==='new' ? 'pill-wait' : 'pill-progress';
  return `<span class="pill ${cls}">${leadStageLabel(stage)}</span>`;
}
function leadsTabHTML(){
  const en = state.language==='en';
  const filter = state.leadStatusFilter || 'all';
  let leads = [...(db.leads||[])].sort((a,b)=>b.createdAt-a.createdAt);
  if(filter!=='all') leads = leads.filter(l=>l.status===filter);
  const counts = {all:(db.leads||[]).length};
  LEAD_STAGES.forEach(s=>counts[s] = (db.leads||[]).filter(l=>l.status===s).length);
  return `
  <div class="section-head">
    <div><div class="sub">${en?"Prospects who haven't had a job yet — track them here until they convert to a real customer.":'Prospek yang belum ada kerja lagi — jejak di sini sehingga mereka jadi pelanggan sebenar.'}</div></div>
    <button class="btn btn-primary" data-action="new-lead">${ICONS.plus} ${en?'New Lead':'Prospek Baharu'}</button>
  </div>
  <div class="tabs">
    <div class="tab-btn ${filter==='all'?'active':''}" data-leadfilter="all">${en?'All':'Semua'} (${counts.all})</div>
    ${LEAD_STAGES.map(s=>`<div class="tab-btn ${filter===s?'active':''}" data-leadfilter="${s}">${leadStageLabel(s)} (${counts[s]})</div>`).join('')}
  </div>
  ${leads.length===0 ? emptyState(en?'No leads in this stage.':'Tiada prospek pada peringkat ini.') : `
  <div class="grid grid-3">
    ${leads.map(l=>{
      const waHref = l.phone ? `https://wa.me/${normalizePhone(l.phone)}` : null;
      const nextStage = l.status==='new' ? 'contacted' : l.status==='contacted' ? 'quoted' : null;
      return `<div class="panel">
        <h2 style="flex-wrap:wrap;"><span style="flex:1;min-width:100px;">${esc(l.name)}</span>${leadStagePill(l.status)}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:4px;">📞 ${esc(l.phone||'-')}</div>
        ${l.source ? `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:4px;">${en?'Source':'Sumber'}: ${esc(l.source)}</div>` : ''}
        ${l.notes ? `<div style="font-size:12px;margin:8px 0;">${esc(l.notes)}</div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
          ${nextStage ? `<button class="btn btn-outline btn-sm" data-action="advance-lead" data-id="${l.id}" data-stage="${nextStage}">${en?'Mark':'Tanda'} ${leadStageLabel(nextStage)}</button>` : ''}
          ${l.status!=='won' && l.status!=='lost' ? `<button class="btn btn-primary btn-sm" data-action="convert-lead" data-id="${l.id}">${en?'Convert to Customer':'Tukar kepada Pelanggan'}</button>` : ''}
          ${l.status!=='lost' && l.status!=='won' ? `<button class="btn-icon" data-action="advance-lead" data-id="${l.id}" data-stage="lost" title="${en?'Mark lost':'Tanda hilang'}">${ICONS.x}</button>` : ''}
          ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="WhatsApp">${ICONS.whatsapp}</a>` : ''}
          <button class="btn-icon" data-action="delete-lead" data-id="${l.id}">${ICONS.trash}</button>
        </div>
      </div>`;
    }).join('')}
  </div>`}
  `;
}
function leadModalHTML(){
  const en = state.language==='en';
  return `
    <h2>${en?'New Lead':'Prospek Baharu'}</h2>
    <div class="field"><label>${tt('Nama')}</label><input id="lead-name" placeholder="Nama penuh"></div>
    <div class="field"><label>${en?'Phone No.':'No. Telefon'}</label><input id="lead-phone" placeholder="012-3456789"></div>
    <div class="field"><label>${en?'Source (optional)':'Sumber (pilihan)'}</label><input id="lead-source" placeholder="${en?'e.g. Facebook, walk-in, referral':'cth: Facebook, walk-in, rujukan'}"></div>
    <div class="field"><label>${tt('Nota')}</label><textarea id="lead-notes" rows="2" placeholder="${en?'What do they need?':'Apa yang mereka perlukan?'}"></textarea></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-lead">${t('btn_save')}</button>
    </div>
  `;
}

function customerModalHTML(){
  return `
    <h2>${tt('Pelanggan Baharu')}</h2>
    <div class="field"><label>${tt('Nama')}</label><input id="cust-name" placeholder="Nama penuh"></div>
    <div class="field"><label>${state.language==='en'?'Phone No.':'No. Telefon'}</label><input id="cust-phone" placeholder="012-3456789"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-customer">${t('btn_save')}</button>
    </div>
  `;
}

function customerEditModalHTML(c){
  return `
    <h2>${tt('Sunting Pelanggan')||'Sunting Pelanggan'}</h2>
    <div class="field"><label>${tt('Nama')}</label><input id="cust-edit-name" value="${esc(c.name)}"></div>
    <div class="field"><label>${state.language==='en'?'Phone No.':'No. Telefon'}</label><input id="cust-edit-phone" value="${esc(c.phone||'')}"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-customer-edit" data-id="${c.id}">${t('btn_save')}</button>
    </div>
  `;
}

function vehicleEditModalHTML(v){
  return `
    <h2>${state.language==='en'?'Edit Vehicle':'Sunting Kenderaan'}</h2>
    <div class="field"><label>${state.language==='en'?'Plate No.':'No. Plat'}</label><input id="veh-edit-plate" value="${esc(v.plate)}"></div>
    <div class="field"><label>Model</label><input id="veh-edit-model" value="${esc(v.model||'')}"></div>
    <div class="field"><label>${state.language==='en'?'Color':'Warna'}</label><input id="veh-edit-color" value="${esc(v.color||'')}"></div>
    <div class="field-row">
      <div class="field"><label>${state.language==='en'?'Odometer Reading (km)':'Bacaan Odometer (km)'}</label><input id="veh-edit-odo" type="number" value="${v.odometer||0}"></div>
      <div class="field"><label>${state.language==='en'?'Service Interval (km)':'Kitaran Servis (km)'}</label><input id="veh-edit-interval" type="number" value="${v.serviceIntervalKm||10000}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-vehicle-edit" data-id="${v.id}">${t('btn_save')}</button>
    </div>
  `;
}

function vehicleHistoryModalHTML(v){
  const c = getCustomer(v.customerId);
  const jobs = db.jobs.filter(j=>j.vehicleId===v.id).sort((a,b)=>b.createdAt-a.createdAt);
  const invoices = db.invoices.filter(i=>i.vehicleId===v.id).sort((a,b)=>b.createdAt-a.createdAt);
  const statusLabel = {waiting:tt('Menunggu'), progress:tt('Dalam Proses'), done:tt('Siap'), delivered:tt('Dihantar')};
  const events = [
    ...jobs.map(j=>({ts:j.createdAt, type:'job', data:j})),
    ...invoices.map(i=>({ts:i.createdAt, type:'invoice', data:i})),
  ].sort((a,b)=>b.ts-a.ts);
  const en = state.language==='en';
  return `
    <h2>${ICONS.history} ${en?'Service History':'Sejarah Servis'} — ${esc(v.plate)}</h2>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;">${esc(v.model)} · ${esc(v.color||'-')} · ${en?'Owner':'Pemilik'}: ${c?esc(c.name):'-'}</div>
    <div style="display:flex;gap:14px;align-items:center;background:var(--panel-alt);border-radius:8px;padding:12px;margin-bottom:16px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(v.plate)}" width="70" height="70" style="border-radius:6px;background:#fff;padding:4px;" alt="QR ${esc(v.plate)}">
      <div style="font-size:11.5px;color:var(--text-muted);flex:1;">${en?"Scan this with any QR app to quickly get the plate number, then paste it into Global Search to instantly open this vehicle's record. Great to stick on the car or vehicle file.":'Imbas kod ini dengan mana-mana apl QR untuk dapatkan no. plat dengan pantas — kemudian tampal ke Carian Global untuk buka rekod kenderaan ini serta-merta. Sesuai dilekat pada kereta atau fail kenderaan.'}</div>
      <button class="btn-icon" data-action="print-vehicle-qr" data-id="${v.id}" title="${en?'Print QR':'Cetak QR'}">${ICONS.printer}</button>
    </div>
    ${(()=>{
      const status = vehicleServiceStatus(v);
      if(!status) return '';
      const { due, kmLeft } = status;
      return `<div style="background:${due?'rgba(225,75,75,.12)':'var(--panel-alt)'};border:1px solid ${due?'var(--danger)':'var(--border)'};border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:12.5px;">
        ${ICONS.gauge} ${en?'Current odometer':'Odometer semasa'}: <strong>${(v.odometer||0).toLocaleString()} km</strong> ·
        ${due ? `<span style="color:var(--danger);font-weight:600;">${en?'Service overdue':'Servis tertunggak'} (${Math.abs(kmLeft).toLocaleString()} km ${en?'past schedule':'lepas jadual'})</span>` : `${en?'Next service in ~':'Servis seterusnya dalam ~'}${kmLeft.toLocaleString()} km`}
      </div>`;
    })()}
    ${events.length===0 ? emptyState(en?'No service history for this vehicle yet.':'Belum ada sejarah servis untuk kenderaan ini.') : `
    <div class="timeline">
      ${events.map(ev=>{
        if(ev.type==='job'){
          const j = /** @type {Job} */ (ev.data);
          return `<div class="timeline-item">
            <div class="timeline-date">${fmtDateTime(j.createdAt)} · ${j.jobNo}</div>
            <div class="timeline-title">${t('nav_jobs')} — ${statusLabel[j.status]}</div>
            <div class="timeline-desc">${esc(j.description||'-')} ${j.mechanic?(en?'· Mechanic: ':'· Mekanik: ')+esc(j.mechanic):''}</div>
          </div>`;
        } else {
          const i = /** @type {Invoice} */ (ev.data);
          const warrantyItems = i.items.filter(it=>{
            if(!it.refId) return false;
            const invItem = getItem(it.refId);
            return invItem && invItem.warrantyMonths>0;
          }).map(it=>{
            const invItem = getItem(it.refId);
            const expiry = i.createdAt + invItem.warrantyMonths*30*24*3600*1000;
            const active = expiry > Date.now();
            return `${esc(it.name)} (${en?'warranty':'waranti'} ${invItem.warrantyMonths}${en?'mo':'bln'}, ${active?(en?'valid until ':'sah hingga ')+fmtDate(expiry):(en?'expired ':'tamat ')+fmtDate(expiry)})`;
          });
          return `<div class="timeline-item">
            <div class="timeline-date">${fmtDateTime(i.createdAt)} · ${i.invoiceNo}</div>
            <div class="timeline-title">${tt('Invois')} — ${fmtRM(i.total)} <span style="color:var(--text-muted);font-weight:400;">(${i.payment})</span></div>
            <div class="timeline-desc">${i.items.map(it=>esc(it.name)+' ×'+it.qty).join(', ')}</div>
            ${warrantyItems.length>0 ? `<div style="font-size:11px;color:var(--accent);margin-top:4px;">${ICONS.gauge} ${warrantyItems.join(' · ')}</div>` : ''}
          </div>`;
        }
      }).join('')}
    </div>`}
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
    </div>
  `;
}

function vehicleModalHTML(customerId){
  return `
    <h2>${tt('Tambah Kenderaan')}</h2>
    <div class="field"><label>${state.language==='en'?'Plate No.':'No. Plat'}</label><input id="veh-plate" placeholder="WXY 1234"></div>
    <div class="field"><label>Model</label><input id="veh-model" placeholder="Perodua Myvi 2019"></div>
    <div class="field"><label>${state.language==='en'?'Color':'Warna'}</label><input id="veh-color" placeholder="Putih"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-vehicle" data-cid="${customerId}">${t('btn_save')}</button>
    </div>
  `;
}

