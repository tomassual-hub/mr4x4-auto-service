/* ============================= TECHNICAL REFERENCE ============================= */
// A structured place for the shop's OWN technical notes per vehicle
// make/model/variant (service schedules, oil types, torque specs, wiring/
// fault-code notes, diagrams, etc.) -- deliberately empty by default and
// filled in by the shop's own mechanics from their own manuals/experience.
// This app never pre-loads or invents technical data here: torque specs,
// wiring diagrams and fault-code guidance are safety-critical and vary
// precisely by exact model/year/engine, so getting one wrong could cause
// real mechanical damage or injury. This is a filing cabinet, not a repair
// database.
const TECH_REF_CATEGORIES = [
  {key:'schedule', ms:'Jadual Servis', en:'Service Schedules'},
  {key:'oil', ms:'Jenis Minyak Enjin', en:'Engine Oil Types'},
  {key:'capacity', ms:'Kapasiti Enjin', en:'Engine Capacities'},
  {key:'maintenance', ms:'Prosedur Penyelenggaraan', en:'Maintenance Procedures'},
  {key:'torque', ms:'Tork Ketatan', en:'Tightening Torques'},
  {key:'belt', ms:'Penggantian Tali Sawat', en:'Belt Renewals'},
  {key:'location', ms:'Lokasi Komponen/Item', en:'Component/Item Locations'},
  {key:'suspension', ms:'Suspensi', en:'Suspension'},
  {key:'transmission', ms:'Transmisi', en:'Transmission'},
  {key:'management', ms:'Pengurusan Enjin (VESA/ABS/ECM/BCM)', en:'Engine Management (VESA/ABS/ECM/BCM)'},
  {key:'diagnostics', ms:'Diagnostik & Gambar Rajah', en:'Diagnostics & Diagrams'},
  {key:'fuses', ms:'Fius & Geganti', en:'Fuses & Relays'},
  {key:'timing', ms:'Tali Sawat/Rantai Masa', en:'Timing Belt/Chain Procedures'},
  {key:'faultcode', ms:'Bantuan Kod Kerosakan', en:'Fault Code Assistance'},
  {key:'drawing', ms:'Lukisan Teknikal', en:'Technical Drawings'},
  {key:'other', ms:'Lain-lain', en:'Other'},
];
function techRefCategoryLabel(key){
  const en = state.language==='en';
  const cat = TECH_REF_CATEGORIES.find(c=>c.key===key);
  return cat ? (en?cat.en:cat.ms) : key;
}

function viewTechRef(){
  const en = state.language==='en';
  const q = (state.techRefSearch||'').toLowerCase().trim();
  let entries = [...(db.techRefs||[])];
  if(q) entries = entries.filter(x => (x.make+' '+x.model+' '+(x.variant||'')).toLowerCase().includes(q));
  entries.sort((a,b)=> (a.make+a.model).localeCompare(b.make+b.model));
  return `
  <div class="section-head">
    <div><div class="sub">${en
      ? "Your shop's own reference notes per vehicle make/model — service schedules, oil types, torque specs, diagrams, fault codes and more. Filled in by your team, not pre-loaded."
      : 'Nota rujukan bengkel anda sendiri ikut jenama/model kenderaan — jadual servis, jenis minyak, spesifikasi tork, gambar rajah, kod kerosakan dan banyak lagi. Diisi oleh pasukan anda sendiri, bukan pra-dimuat.'}</div></div>
    <button class="btn btn-primary" data-action="new-techref">${ICONS.plus} ${en?'New Reference':'Rujukan Baharu'}</button>
  </div>
  <div class="search-box">${ICONS.search}<input id="techref-search" placeholder="${en?'Search make, model, variant...':'Cari jenama, model, varian...'}" value="${esc(state.techRefSearch||'')}"></div>
  ${entries.length===0 ? emptyState(en
      ? ((db.techRefs||[]).length===0 ? 'No technical reference entries yet. Add your first vehicle make/model.' : 'No matches.')
      : ((db.techRefs||[]).length===0 ? 'Belum ada rujukan teknikal. Tambah jenama/model kenderaan pertama.' : 'Tiada padanan.')) : `
  <div class="grid grid-3">
    ${entries.map(x=>`
      <div class="panel clickable" data-action="open-techref" data-id="${x.id}">
        <h2>${ICONS.book} ${esc(x.make)} ${esc(x.model)}</h2>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;min-height:15px;">${esc(x.variant||'')}</div>
        <span class="pill pill-progress">${(x.sections||[]).length} ${en?'section(s)':'bahagian'}</span>
      </div>
    `).join('')}
  </div>`}
  `;
}

function techRefModalHTML(entry){
  const en = state.language==='en';
  const isEdit = !!entry;
  entry = entry || {make:'', model:'', variant:'', yearFrom:'', yearTo:'', notes:''};
  return `
    <h2>${isEdit ? (en?'Edit Reference':'Sunting Rujukan') : (en?'New Technical Reference':'Rujukan Teknikal Baharu')}</h2>
    <div class="field-row">
      <div class="field"><label>${en?'Make':'Jenama'}</label><input id="tr-make" value="${esc(entry.make)}" placeholder="Cth: Toyota"></div>
      <div class="field"><label>${en?'Model':'Model'}</label><input id="tr-model" value="${esc(entry.model)}" placeholder="Cth: Hilux"></div>
    </div>
    <div class="field"><label>${en?'Variant / Engine (optional)':'Varian / Enjin (pilihan)'}</label><input id="tr-variant" value="${esc(entry.variant||'')}" placeholder="Cth: 2.8L Diesel 1GD-FTV"></div>
    <div class="field-row">
      <div class="field"><label>${en?'Year From':'Tahun Dari'}</label><input id="tr-year-from" type="number" value="${esc(entry.yearFrom||'')}" placeholder="2015"></div>
      <div class="field"><label>${en?'Year To':'Tahun Hingga'}</label><input id="tr-year-to" type="number" value="${esc(entry.yearTo||'')}" placeholder="2023"></div>
    </div>
    <div class="field"><label>${en?'General Notes (optional)':'Nota Am (pilihan)'}</label><textarea id="tr-notes" rows="2">${esc(entry.notes||'')}</textarea></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-techref" data-id="${entry.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

function techRefDetailModalHTML(entry){
  const en = state.language==='en';
  const editingId = state.techRefEditingSectionId || null;
  const editingSection = editingId ? (entry.sections||[]).find(s=>s.id===editingId) : null;
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <h2 style="margin-bottom:2px;">${esc(entry.make)} ${esc(entry.model)}</h2>
        <div style="font-size:12px;color:var(--text-muted);">${esc(entry.variant||'')}${entry.yearFrom?` · ${esc(entry.yearFrom)}${entry.yearTo?'–'+esc(entry.yearTo):''}`:''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn-icon" data-action="edit-techref" data-id="${entry.id}" title="${t('btn_edit')}">${ICONS.edit}</button>
        <button class="btn-icon" data-action="delete-techref" data-id="${entry.id}" title="${t('btn_delete')}">${ICONS.trash}</button>
      </div>
    </div>
    ${entry.notes ? `<p style="font-size:12.5px;color:var(--text-muted);margin:12px 0 0;white-space:pre-wrap;">${esc(entry.notes)}</p>` : ''}
    <div style="border-top:1px solid var(--glass-border);margin:16px 0;"></div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:700;margin-bottom:10px;">${en?'Sections':'Bahagian'} (${(entry.sections||[]).length})</div>
    ${(entry.sections||[]).length===0 ? `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:16px;">${en?'No sections yet — add the first one below.':'Belum ada bahagian — tambah yang pertama di bawah.'}</div>` : (entry.sections||[]).map(s=>`
      <div style="background:var(--glass-2);border:1px solid var(--glass-border);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px;">
          <span class="pill pill-wait">${esc(techRefCategoryLabel(s.category))}</span>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn-icon" data-action="edit-techref-section" data-id="${s.id}" style="padding:5px;" title="${state.language==='en'?'Edit section':'Sunting seksyen'}">${ICONS.edit}</button>
            <button class="btn-icon" data-action="delete-techref-section" data-id="${s.id}" style="padding:5px;" title="${state.language==='en'?'Delete section':'Padam seksyen'}">${ICONS.trash}</button>
          </div>
        </div>
        <div style="font-size:12.5px;white-space:pre-wrap;">${esc(s.content||'')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;">
          ${(s.photos||[]).map((p,idx)=>`
            <div style="position:relative;">
              <img src="${p}" alt="${en?'Diagram':'Gambar rajah'}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
              <button class="btn-icon" data-action="remove-techref-photo" data-section-id="${s.id}" data-idx="${idx}" title="${state.language==='en'?'Remove photo':'Buang gambar'}" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;padding:0;background:var(--danger);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">${ICONS.x}</button>
            </div>`).join('')}
          ${(s.photos||[]).length<4 ? `
            <label class="btn-icon" style="cursor:pointer;width:64px;height:64px;display:flex;align-items:center;justify-content:center;" title="${en?'Add photo/diagram':'Tambah gambar/gambar rajah'}">
              ${ICONS.upload}
              <input type="file" accept="image/*" data-techref-photo-input data-section-id="${s.id}" style="display:none;">
            </label>` : ''}
        </div>
      </div>
    `).join('')}
    <div style="border-top:1px dashed var(--glass-border);margin:16px 0;"></div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-muted);font-weight:700;margin-bottom:10px;">${editingSection ? (en?'Edit Section':'Sunting Bahagian') : (en?'Add Section':'Tambah Bahagian')}</div>
    <div class="field"><label>${en?'Category':'Kategori'}</label>
      <select id="tr-section-category">
        ${TECH_REF_CATEGORIES.map(c=>`<option value="${c.key}" ${editingSection?editingSection.category===c.key?'selected':'':''}>${en?c.en:c.ms}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${en?'Notes':'Nota'}</label><textarea id="tr-section-content" rows="4" placeholder="${en?'Enter the details from your service manual...':'Masukkan butiran daripada manual servis anda...'}">${editingSection?esc(editingSection.content||''):''}</textarea></div>
    <div class="modal-foot">
      ${editingSection ? `<button class="btn btn-outline" data-action="cancel-techref-section-edit">${t('btn_cancel')}</button>` : ''}
      <button class="btn btn-primary" data-action="save-techref-section" data-entry-id="${entry.id}" data-editing-id="${editingId||''}">${editingSection ? (en?'Update Section':'Kemaskini Bahagian') : (en?'Add Section':'Tambah Bahagian')}</button>
    </div>
    <div style="text-align:center;margin-top:6px;">
      <span class="clickable" data-action="close-modal" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">${t('btn_close')}</span>
    </div>
  `;
}
