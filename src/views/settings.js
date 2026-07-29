/* ============================= SETTINGS ============================= */
function viewSettings(){
  const s = db.settings;
  return `
  <div class="grid grid-2" id="settings-view">
    <div class="panel">
      <h2>${ICONS.settings} ${tt('Maklumat Kedai')}</h2>
      <div class="field"><label>${tt('Nama Bengkel')}</label><input id="set-shopname" value="${s.shopName}"></div>
      <div class="field"><label>${tt('No. Telefon Bengkel')}</label><input id="set-shopphone" value="${s.shopPhone||''}" placeholder="012-3456789"></div>
      <div class="field"><label>${state.language==='en'?'Business Address':'Alamat Perniagaan'}</label><textarea id="set-shopaddress" rows="2" placeholder="${state.language==='en'?'For printed invoices':'Untuk invois cetak'}">${esc(s.shopAddress||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>${state.language==='en'?'SSM Reg. No.':'No. Pendaftaran SSM'}</label><input id="set-shopregno" value="${esc(s.shopRegNo||'')}" placeholder="cth: 202301012345 (678901-A)"></div>
        <div class="field"><label>${state.language==='en'?'SST Reg. No. (if any)':'No. Pendaftaran SST (jika ada)'}</label><input id="set-shopsstno" value="${esc(s.shopSstNo||'')}" placeholder="${state.language==='en'?'Leave blank if not registered':'Kosongkan jika tidak berdaftar'}"></div>
      </div>
      <div class="field"><label>${state.language==='en'?'Tax ID (TIN)':'No. Pengenalan Cukai (TIN)'}</label><input id="set-shoptin" value="${esc(s.shopTin||'')}" placeholder="cth: IG12345678090"></div>
      <div class="field"><label>${tt('Kadar SST (%)')}</label><input id="set-tax" type="number" min="0" step="0.1" value="${s.taxRate||0}"></div>
      <div class="field-row">
        <div class="field"><label>${tt('Diskaun Setia (%)')}</label><input id="set-loyalty-discount" type="number" min="0" value="${s.loyaltyDiscount||10}"></div>
        <div class="field"><label>${tt('Lawatan Layak Diskaun')}</label><input id="set-loyalty-visits" type="number" min="1" value="${s.loyaltyVisits||5}"></div>
      </div>
      <div class="field"><label>${tt('Anggap "Senyap" selepas (hari)')}</label><input id="set-churn-days" type="number" min="1" value="${s.churnDays||180}"></div>
      <div class="field" style="display:flex;align-items:center;justify-content:space-between;background:var(--panel-alt);padding:12px;border-radius:8px;">
        <div>
          <label style="margin-bottom:2px;">${state.language==='en'?'Simple Mode':'Mod Ringkas'}</label>
          <div style="font-size:11.5px;color:var(--text-muted);">${state.language==='en'?'Hides advanced features (appointments, suppliers, purchase orders, P&L, commission, forecasting) for a cleaner day-to-day view.':'Sorok ciri lanjutan (tempahan, pembekal, pesanan belian, P&L, komisen, ramalan) untuk paparan harian yang lebih ringkas.'}</div>
        </div>
        <input type="checkbox" id="set-simple-mode" ${s.simpleMode?'checked':''} style="width:20px;height:20px;flex-shrink:0;">
      </div>
      <button class="btn btn-primary" data-action="save-settings">${tt('Simpan Tetapan')}</button>

      <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--border);">
        <h2 style="font-size:14px;">${ICONS.calendar} ${tt('Cawangan')}</h2>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
          ${db.branches.map(b=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--panel-alt);border-radius:6px;">
              <span style="font-size:13px;">${esc(b.name)}</span>
              ${db.branches.length>1 ? `<button class="btn-icon" data-action="delete-branch" data-id="${b.id}">${ICONS.trash}</button>` : ''}
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <input id="new-branch-name" placeholder="${state.language==='en'?'New branch name':'Nama cawangan baharu'}" style="flex:1;">
          <button class="btn btn-outline btn-sm" data-action="add-branch">${ICONS.plus}</button>
        </div>
      </div>

      <div style="margin-top:22px;padding-top:18px;border-top:1px dashed var(--border);">
        <h2 style="font-size:14px;">${ICONS.barcode} ${tt('Kod QR Bayaran (DuitNow)')}</h2>
        <p style="font-size:11.5px;color:var(--text-muted);margin-top:0;">${tt('Muat naik kod QR DuitNow bengkel anda untuk dipaparkan pada invois cetak, supaya pelanggan boleh imbas terus untuk bayar.')}</p>
        ${s.paymentQR ? `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
          <img src="${s.paymentQR}" alt="DuitNow QR" style="width:88px;height:88px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;border:1px solid var(--border);">
          <button class="btn btn-outline btn-sm" data-action="remove-payment-qr">${ICONS.trash} ${tt('Buang Kod QR')}</button>
        </div>` : ''}
        <input type="file" id="payment-qr-input" accept="image/*" style="padding:8px;">
      </div>
    </div>
    <div class="panel">
      <h2>${ICONS.download} ${tt('Sandaran & Pemulihan Data')}</h2>
      ${(()=>{
        const en = state.language==='en';
        const last = s.lastBackupAt;
        const daysSince = last ? Math.floor((Date.now()-last)/86400000) : null;
        const warn = !last || daysSince>=7;
        const label = !last ? (en?'Never backed up yet.':'Belum pernah disandarkan.')
          : daysSince===0 ? (en?'Last backup: today.':'Sandaran terakhir: hari ini.')
          : (en?`Last backup: ${daysSince} day(s) ago.`:`Sandaran terakhir: ${daysSince} hari lalu.`);
        return `<div style="font-size:12px;margin-bottom:12px;color:${warn?'var(--danger)':'var(--text-muted)'};">${warn?'⚠️ ':''}${label}</div>`;
      })()}
      ${(()=>{
        const sizeMB = JSON.stringify(db).length/1024/1024;
        const pct = Math.min(100, (sizeMB/5*100));
        const en = state.language==='en';
        return `<div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-muted);margin-bottom:4px;">
            <span>${en?'Storage used':'Storan digunakan'}</span>
            <span>${sizeMB.toFixed(2)} MB / ~5 MB</span>
          </div>
          <div class="chart-bar-track" style="height:8px;"><div class="chart-bar-fill" style="width:${pct.toFixed(0)}%;background:${pct>=80?'var(--danger)':'linear-gradient(90deg,var(--accent-2),var(--accent))'};"></div></div>
          ${pct>=80 ? `<div style="font-size:11px;color:var(--danger);margin-top:4px;">${en?'Getting full — consider deleting old job photos or archiving old invoices.':'Hampir penuh — pertimbangkan padam gambar kad kerja lama atau arkibkan invois lama.'}</div>` : ''}
        </div>`;
      })()}
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${tt('Muat turun semua data bengkel (pelanggan, invois, inventori, dll.) sebagai fail sandaran. Simpan secara berkala untuk keselamatan.')}</p>
      <button class="btn btn-outline" style="width:100%;justify-content:center;margin-bottom:10px;" data-action="export-backup">${ICONS.download} ${tt('Muat Turun Sandaran (JSON)')}</button>
      <label style="display:block;">${tt('Pulihkan daripada Fail Sandaran')}</label>
      <input type="file" id="restore-file" accept="application/json" style="padding:8px;">
      <div style="font-size:11.5px;color:var(--danger);margin-top:8px;">⚠️ ${tt('Memulihkan akan menggantikan SEMUA data semasa.')}</div>
      ${state.currentStaff && state.currentStaff.role==='Admin' ? `
      <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border);">
        <h2 style="font-size:13px;">${ICONS.download} ${state.language==='en'?'Automatic Backups':'Sandaran Automatik'}</h2>
        <p style="font-size:11.5px;color:var(--text-muted);margin-top:0;">${state.language==='en'?'A snapshot is saved to the server automatically (at most every 7 days) whenever an Admin logs in — a recovery point even if nobody remembers to download one.':'Satu salinan disimpan ke pelayan secara automatik (selang 7 hari) setiap kali Admin log masuk — titik pemulihan walaupun tiada siapa ingat untuk muat turun.'}</p>
        ${state.autoBackupsList ? `
          ${state.autoBackupsList.length===0 ? `<div style="font-size:12px;color:var(--text-muted);">${state.language==='en'?'No automatic backups yet.':'Belum ada sandaran automatik.'}</div>` : state.autoBackupsList.map(b=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--panel-alt);border-radius:6px;margin-bottom:6px;">
            <span style="font-size:12.5px;">${fmtDateTime(new Date(b.created_at).getTime())}</span>
            <button class="btn btn-outline btn-sm" data-action="download-auto-backup" data-id="${b.id}">${ICONS.download}</button>
          </div>`).join('')}
        ` : `<button class="btn btn-outline btn-sm" data-action="list-auto-backups">${state.language==='en'?'Show Automatic Backups':'Papar Sandaran Automatik'}</button>`}
      </div>` : ''}
      <div class="panel" style="margin-top:18px;padding:14px;background:var(--panel-alt);">
        <h2 style="font-size:13px;">${ICONS.download} ${tt('Eksport CSV')}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" data-action="export-csv-invoices">${tt('Invois')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-inventory">${tt('Inventori')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-customers">${tt('Pelanggan')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-accounting">${tt('Format Perakaunan')}</button>
          <button class="btn btn-outline btn-sm" data-action="export-csv-payroll">${tt('Gaji')}</button>
        </div>
      </div>
    </div>
  </div>
  `;
}

