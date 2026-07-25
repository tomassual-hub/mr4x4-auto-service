/* ============================= CUSTOMERS VIEW ============================= */
function viewCustomers(){
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
      const nextKm = (v.lastServiceKm||0) + (v.serviceIntervalKm||10000);
      const kmLeft = nextKm - (v.odometer||0);
      if(!v.serviceIntervalKm) return '';
      const due = kmLeft<=0;
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

