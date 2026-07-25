/* ============================= APPOINTMENTS & CONTRACTS ============================= */
function viewAppointments(){
  const statusLabel = {scheduled:tt('Dijadualkan'), done:tt('Selesai')||'Selesai', cancelled:tt('Dibatalkan')};
  const appts = [...db.appointments].sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
  const now = Date.now();

  const apptTabHTML = `
    <div class="section-head">
      <div><div class="sub">${tt('Jadual janji temu servis pelanggan')}</div></div>
      <button class="btn btn-primary" data-action="new-appointment">${ICONS.plus} ${tt('Tempahan Baharu')}</button>
    </div>
    ${appts.length===0 ? emptyState(tt('Tiada tempahan dijadualkan.')) : `
    <div class="panel">
      <div class="table-wrap"><table>
        <thead><tr><th>${state.language==='en'?'Date & Time':'Tarikh & Masa'}</th><th>${tt('Pelanggan')}</th><th>${tt('Kenderaan')}</th><th>${tt('Nota')}</th><th>${tt('Status')}</th><th></th></tr></thead>
        <tbody>
          ${appts.map(a=>{
            const c = getCustomer(a.customerId); const v = getVehicle(a.vehicleId);
            const waText = encodeURIComponent(`Salam ${c?c.name:''}, ini peringatan tempahan servis kenderaan ${v?v.plate:''} pada ${a.date} jam ${a.time} di ${db.settings.shopName}. Sila hubungi kami jika perlu tukar masa. Terima kasih!`);
            const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
            return `<tr>
              <td style="font-family:'IBM Plex Mono',monospace;">${a.date} · ${a.time}</td>
              <td>${c?esc(c.name):'-'}</td>
              <td>${v?esc(v.plate):'-'}</td>
              <td style="max-width:200px;">${esc(a.notes||'-')}</td>
              <td><span class="pill ${a.status==='done'?'pill-done':a.status==='cancelled'?'pill-low':'pill-wait'}">${statusLabel[a.status]}</span></td>
              <td style="white-space:nowrap;">
                ${a.status==='scheduled' ? `<button class="btn-icon" data-action="appt-done" data-id="${a.id}" title="${tt('Tandakan selesai')}">${ICONS.done||'✓'}</button>
                <button class="btn-icon" data-action="appt-cancel" data-id="${a.id}" title="${tt('Batal')}">${ICONS.x}</button>
                ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="${tt('Hantar peringatan WhatsApp')}" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}` : ''}
                <button class="btn-icon" data-action="delete-appointment" data-id="${a.id}">${ICONS.trash}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`}
  `;

  const contracts = [...db.contracts].sort((a,b)=>a.nextDue-b.nextDue);
  const contractTabHTML = `
    <div class="section-head">
      <div><div class="sub">${tt('Invois berulang untuk pelanggan korporat / armada kenderaan')}</div></div>
      <button class="btn btn-primary" data-action="new-contract">${ICONS.plus} ${tt('Kontrak Baharu')}</button>
    </div>
    ${contracts.length===0 ? emptyState(tt('Tiada kontrak servis ditubuhkan.')) : `
    <div class="grid grid-3">
      ${contracts.map(ct=>{
        const c = getCustomer(ct.customerId); const v = getVehicle(ct.vehicleId);
        const overdue = ct.nextDue <= now;
        const total = ct.items.reduce((s,i)=>s+i.price*i.qty,0);
        return `<div class="panel">
          <h2>${esc(ct.label)} ${overdue ? `<span class="pill pill-low" style="margin-left:auto;">${tt('Tertunggak')}</span>` : ''}</h2>
          <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px;">${c?esc(c.name):'-'} · ${v?esc(v.plate):'-'}</div>
          <div style="font-size:12.5px;color:var(--text-muted);">${tt('Kitaran: setiap')} ${ct.frequencyDays} ${tt('hari')}</div>
          <div style="font-size:12.5px;color:var(--text-muted);">${tt('Seterusnya')}: ${fmtDate(ct.nextDue)}</div>
          <div style="font-weight:600;color:var(--accent);margin:8px 0;">${fmtRM(total)} ${tt('/ kitaran')}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" style="flex:1;" data-action="generate-contract" data-id="${ct.id}">${ICONS.repeat} ${tt('Jana Invois')}</button>
            <button class="btn btn-danger btn-sm" data-action="delete-contract" data-id="${ct.id}">${ICONS.trash}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  `;

  return `
  <div class="tabs">
    <div class="tab-btn ${state.apptTab==='appointments'?'active':''}" data-appttab="appointments">${ICONS.calendar} ${tt('Tempahan')}</div>
    <div class="tab-btn ${state.apptTab==='contracts'?'active':''}" data-appttab="contracts">${ICONS.repeat} ${tt('Kontrak Servis')}</div>
  </div>
  ${state.apptTab==='appointments' ? apptTabHTML : contractTabHTML}
  `;
}

function appointmentModalHTML(){
  const en = state.language==='en';
  return `
    <h2>${tt('Tempahan Baharu')}</h2>
    <div class="field"><label>${tt('Pelanggan')}</label>
      <select id="ap-customer">
        <option value="">— ${en?'Select Customer':'Pilih Pelanggan'} —</option>
        ${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${tt('Kenderaan')}</label>
      <select id="ap-vehicle"><option value="">— ${en?'Select Customer First':'Pilih Pelanggan Dahulu'} —</option></select>
    </div>
    <div class="field-row">
      <div class="field"><label>${tt('Tarikh')}</label><input id="ap-date" type="date"></div>
      <div class="field"><label>${en?'Time':'Masa'}</label><input id="ap-time" type="time"></div>
    </div>
    <div class="field"><label>${tt('Nota')}</label><textarea id="ap-notes" rows="2" placeholder="Cth: servis 10,000km"></textarea></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-appointment">${en?'Save Appointment':'Simpan Tempahan'}</button>
    </div>
  `;
}

function contractModalHTML(){
  const en = state.language==='en';
  return `
    <h2>${en?'New Service Contract':'Kontrak Servis Baharu'}</h2>
    <div class="field"><label>${en?'Contract Name':'Nama Kontrak'}</label><input id="ct-label" placeholder="Cth: Servis Bulanan Armada Syarikat ABC"></div>
    <div class="field"><label>${tt('Pelanggan')}</label>
      <select id="ct-customer">
        <option value="">— ${en?'Select Customer':'Pilih Pelanggan'} —</option>
        ${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${tt('Kenderaan')}</label>
      <select id="ct-vehicle"><option value="">— ${en?'Select Customer First':'Pilih Pelanggan Dahulu'} —</option></select>
    </div>
    <div class="field"><label>${en?'Frequency (days)':'Kekerapan (hari)'}</label><input id="ct-freq" type="number" value="30"></div>
    <div class="field"><label>${en?'Items / Services (name:price, one per line)':'Item / Servis (nama:harga, satu setiap baris)'}</label>
      <textarea id="ct-items" rows="3" placeholder="Servis biasa:150&#10;Tukar minyak:65"></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-contract">${en?'Save Contract':'Simpan Kontrak'}</button>
    </div>
  `;
}

