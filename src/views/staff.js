/* ============================= STAFF VIEW ============================= */
function viewStaff(){
  const tab = state.staffTab || 'staff';
  const adminCount = db.staff.filter(s=>s.role==='Admin').length;
  const staffTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Urus akaun staf & mekanik yang boleh log masuk')}</div></div>
    <button class="btn btn-primary" data-action="new-staff">${ICONS.plus} ${tt('Staf Baharu')}</button>
  </div>
  <div class="grid grid-3">
    ${db.staff.map(s=>{
      const isLastAdmin = s.role==='Admin' && adminCount===1;
      return `
      <div class="panel" style="text-align:center;">
        <div class="staff-avatar" style="margin:0 auto 10px;">${initials(s.name)}</div>
        <div class="staff-name">${esc(s.name)}</div>
        <div class="staff-role">${s.role}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${esc(s.email||'')}${s.userId ? ` · ${state.language==='en'?'Linked':'Ditaut'}` : s.email ? ` · ${state.language==='en'?'Not linked yet':'Belum ditaut'}` : ''}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
          <button class="btn btn-outline btn-sm" data-action="edit-staff" data-id="${s.id}">${ICONS.edit} ${tt('Sunting')}</button>
          ${db.staff.length>1 && !isLastAdmin ? `<button class="btn btn-danger btn-sm" data-action="delete-staff" data-id="${s.id}">${ICONS.trash}</button>` : ''}
        </div>
      </div>`;}).join('')}
  </div>
  `;
  const auditTabHTML = `
  <div class="section-head"><div><div class="sub">${tt('Rekod semua tindakan penting oleh staf untuk akauntabiliti')}</div></div></div>
  <div class="panel">
    ${db.auditLog.length===0 ? emptyState(tt('Tiada aktiviti direkod lagi.')) : `
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Masa')}</th><th>${tt('Staf')||'Staf'}</th><th>${tt('Tindakan')}</th><th>${tt('Butiran')}</th></tr></thead>
      <tbody>
        ${db.auditLog.slice(0,100).map(a=>`
          <tr>
            <td style="font-family:'IBM Plex Mono',monospace;white-space:nowrap;">${fmtDateTime(a.ts)}</td>
            <td>${esc(a.staff)}</td>
            <td><span class="pill pill-wait">${esc(a.action)}</span></td>
            <td style="color:var(--text-muted);">${esc(a.detail)}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
  `;
  return `
  <div class="tabs">
    <div class="tab-btn ${tab==='staff'?'active':''}" data-stafftab="staff">${ICONS.staff} ${t('nav_staff')}</div>
    <div class="tab-btn ${tab==='audit'?'active':''}" data-stafftab="audit">${ICONS.history} ${tt('Log Aktiviti')}</div>
  </div>
  ${tab==='staff' ? staffTabHTML : auditTabHTML}
  `;
}

function staffModalHTML(staffMember){
  const isEdit = !!staffMember;
  const en = state.language==='en';
  staffMember = staffMember || {name:'', role:'Mekanik', email:'', commissionPercent:0, baseSalary:0};
  return `
    <h2>${isEdit?tt('Sunting Staf'):tt('Staf Baharu')}</h2>
    <div class="field"><label>${tt('Nama')||'Nama'}</label><input id="sf-name" value="${esc(staffMember.name)}" placeholder="Nama staf"></div>
    <div class="field"><label>${tt('Peranan')||'Peranan'}</label>
      <select id="sf-role">
        <option value="Admin" ${staffMember.role==='Admin'?'selected':''}>Admin</option>
        <option value="Kerani" ${staffMember.role==='Kerani'?'selected':''}>Kerani</option>
        <option value="Ketua Mekanik" ${staffMember.role==='Ketua Mekanik'?'selected':''}>Ketua Mekanik</option>
        <option value="Mekanik" ${staffMember.role==='Mekanik'?'selected':''}>Mekanik</option>
      </select>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
        ${en?'"Head Mechanic" is a title only — same restricted access as Mekanik (no sales/revenue figures).':'"Ketua Mekanik" cuma gelaran — akses terhad sama seperti Mekanik (tiada lihat jualan/hasil).'}<br>
        ${en?'"Kerani" has full Admin-level access (Staff, Settings, Payroll, Reports) EXCEPT sales/revenue figures.':'"Kerani" ada akses penuh setaraf Admin (Staf, Tetapan, Gaji, Laporan) KECUALI angka jualan/pendapatan.'}
      </div>
    </div>
    <div class="field">
      <label>${en?'Login Email':'E-mel Log Masuk'}</label>
      <input id="sf-email" type="email" value="${esc(staffMember.email||'')}" placeholder="nama@contoh.com">
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${en
        ? (staffMember.userId ? 'Linked to a login account.' : 'Not linked yet — tell them to open the app and tap "New staff? Create an account" using this exact email.')
        : (staffMember.userId ? 'Sudah ditautkan dengan akaun log masuk.' : 'Belum ditautkan — minta mereka buka aplikasi dan tekan "Staf baharu? Daftar akaun" menggunakan e-mel yang sama ini.')}</div>
    </div>
    <div class="field"><label>${en?'Base Salary (RM/month)':'Gaji Pokok (RM/bulan)'}</label><input id="sf-basesalary" type="number" min="0" step="0.01" value="${staffMember.baseSalary||0}"></div>
    <div class="field"><label>Komisen (% daripada nilai kerja disiapkan)</label><input id="sf-commission" type="number" min="0" max="100" value="${staffMember.commissionPercent||0}"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">Batal</button>
      <button class="btn btn-primary" data-action="save-staff" data-id="${staffMember.id||''}">Simpan</button>
    </div>
  `;
}

