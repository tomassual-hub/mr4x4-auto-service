/* ============================= INVENTORY VIEW ============================= */
function viewInventory(){
  const tab = state.invMainTab || 'items';
  let items = [...db.inventory];
  if(state.invTab==='low') items = items.filter(i=>i.qty<=i.lowStock);
  items.sort((a,b)=>a.name.localeCompare(b.name));
  const lowCount = db.inventory.filter(i=>i.qty<=i.lowStock).length;

  const itemsTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Urus stok alat ganti & bekalan bengkel')}</div></div>
    <button class="btn btn-primary" data-action="new-item">${ICONS.plus} ${tt('Item Baharu')}</button>
  </div>
  <div class="tabs">
    <div class="tab-btn ${state.invTab==='semua'?'active':''}" data-invtab="semua">${tt('Semua')} (${db.inventory.length})</div>
    <div class="tab-btn ${state.invTab==='low'?'active':''}" data-invtab="low">${tt('Stok Rendah')} (${lowCount})</div>
  </div>
  <div class="panel">
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('Nama Item')}</th><th>${tt('SKU')}</th><th>${tt('Kuantiti')}</th><th>${tt('Kos')}</th><th>${tt('Harga Jual')}</th><th>${tt('Pembekal')}</th><th>${tt('Status')}</th><th></th></tr></thead>
      <tbody>
        ${items.length===0 ? `<tr><td colspan="8">${emptyState(tt('Tiada item.'))}</td></tr>` : items.map(i=>{
          const sup = db.suppliers.find(s=>s.id===i.supplierId);
          return `<tr>
            <td style="font-weight:600;">${esc(i.name)}</td>
            <td style="font-family:'IBM Plex Mono',monospace;color:var(--text-muted);">${esc(i.sku)}</td>
            <td>${i.qty}</td>
            <td>${fmtRM(i.cost)}</td>
            <td style="color:var(--accent);font-weight:600;">${fmtRM(i.price)}</td>
            <td style="color:var(--text-muted);font-size:12px;">${sup?sup.name:'-'}</td>
            <td>${i.qty<=i.lowStock ? `<span class="pill pill-low">${tt('Rendah')}</span>` : `<span class="pill pill-done">${tt('OK')}</span>`}</td>
            <td>
              <button class="btn-icon" data-action="edit-item" data-id="${i.id}">${ICONS.edit}</button>
              <button class="btn-icon" data-action="delete-item" data-id="${i.id}">${ICONS.trash}</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  </div>`;

  const suppliersTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Senarai pembekal alat ganti bengkel')}</div></div>
    <button class="btn btn-primary" data-action="new-supplier">${ICONS.plus} ${tt('Pembekal Baharu')}</button>
  </div>
  ${db.suppliers.length===0 ? emptyState(tt('Tiada pembekal direkod.')) : `
  <div class="grid grid-3">
    ${db.suppliers.map(s=>{
      const itemCount = db.inventory.filter(i=>i.supplierId===s.id).length;
      return `<div class="panel">
        <h2>${esc(s.name)}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px;">📞 ${esc(s.phone||'-')}</div>
        <div style="font-size:12px;color:var(--text-muted);">${itemCount} ${tt('item dibekalkan')}</div>
        <button class="btn btn-danger btn-sm" style="margin-top:10px;width:100%;" data-action="delete-supplier" data-id="${s.id}">${ICONS.trash} ${tt('Padam')}</button>
      </div>`;
    }).join('')}
  </div>`}
  `;

  const poTabHTML = `
  <div class="section-head">
    <div><div class="sub">${tt('Pesanan belian untuk isi semula stok')}</div></div>
    <button class="btn btn-primary" data-action="new-po">${ICONS.plus} ${tt('Pesanan Baharu')}</button>
  </div>
  ${lowCount>0 ? `<div class="panel" style="margin-bottom:16px;background:rgba(242,167,59,.1);border-color:var(--accent);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div style="font-size:13px;">${ICONS.alert} ${lowCount} ${tt('item stok rendah — jana pesanan belian automatik?')}</div>
      <button class="btn btn-outline btn-sm" data-action="auto-po">${tt('Jana Pesanan Auto')}</button>
    </div>
  </div>` : ''}
  ${db.purchaseOrders.length===0 ? emptyState(tt('Tiada pesanan belian.')) : `
  <div class="panel">
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('No. PO')}</th><th>${tt('Pembekal')}</th><th>${tt('Item')}</th><th>${tt('Jumlah')}</th><th>${tt('Status')}</th><th></th></tr></thead>
      <tbody>
        ${[...db.purchaseOrders].sort((a,b)=>b.createdAt-a.createdAt).map(po=>{
          const sup = db.suppliers.find(s=>s.id===po.supplierId);
          const total = po.items.reduce((s,i)=>s+i.cost*i.qty,0);
          return `<tr>
            <td style="font-family:'IBM Plex Mono',monospace;">${po.poNo}</td>
            <td>${sup?sup.name:'-'}</td>
            <td style="font-size:12px;color:var(--text-muted);">${po.items.map(i=>esc(i.name)+' ×'+i.qty).join(', ')}</td>
            <td style="color:var(--accent);font-weight:600;">${fmtRM(total)}</td>
            <td><span class="pill ${po.status==='received'?'pill-done':'pill-wait'}">${po.status==='received'?tt('Diterima'):tt('Belum Diterima')}</span></td>
            <td>${po.status!=='received' ? `<button class="btn-icon" data-action="receive-po" data-id="${po.id}" title="Tandakan diterima & tambah stok">${ICONS.download}</button>` : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  </div>`}
  `;

  return `
  ${db.settings.simpleMode ? '' : `
  <div class="tabs">
    <div class="tab-btn ${tab==='items'?'active':''}" data-invmaintab="items">${ICONS.inventory} ${tt('Item')}</div>
    <div class="tab-btn ${tab==='suppliers'?'active':''}" data-invmaintab="suppliers">${ICONS.staff} ${tt('Pembekal')}</div>
    <div class="tab-btn ${tab==='po'?'active':''}" data-invmaintab="po">${ICONS.repeat} ${tt('Pesanan Belian')}</div>
  </div>`}
  ${db.settings.simpleMode ? itemsTabHTML : (tab==='items' ? itemsTabHTML : tab==='suppliers' ? suppliersTabHTML : poTabHTML)}
  `;
}

function itemModalHTML(item){
  const isEdit = !!item;
  item = item || {name:'',sku:'',qty:0,cost:0,price:0,lowStock:5,supplierId:''};
  return `
    <h2>${isEdit?(state.language==='en'?'Update Item':'Kemaskini Item'):tt('Item Baharu')}</h2>
    <div class="field"><label>${tt('Nama Item')}</label><input id="it-name" value="${esc(item.name)}" placeholder="Cth: Minyak Enjin 5W-30"></div>
    <div class="field-row">
      <div class="field"><label>${state.language==='en'?'SKU Code':'Kod SKU'}</label><input id="it-sku" value="${esc(item.sku)}" placeholder="OIL-5W30"></div>
      <div class="field"><label>${tt('Kuantiti')}</label><input id="it-qty" type="number" value="${item.qty}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>${state.language==='en'?'Cost Price (RM)':'Harga Kos (RM)'}</label><input id="it-cost" type="number" step="0.01" value="${item.cost}"></div>
      <div class="field"><label>${state.language==='en'?'Sell Price (RM)':'Harga Jual (RM)'}</label><input id="it-price" type="number" step="0.01" value="${item.price}"></div>
    </div>
    <div class="field"><label>${state.language==='en'?'Low Stock Alert (qty)':'Amaran Stok Rendah (kuantiti)'}</label><input id="it-low" type="number" value="${item.lowStock}"></div>
    <div class="field"><label>${state.language==='en'?'Warranty Period (months, 0 if none)':'Tempoh Waranti (bulan, 0 jika tiada)'}</label><input id="it-warranty" type="number" min="0" value="${item.warrantyMonths||0}"></div>
    <div class="field"><label>${tt('Pembekal')}</label>
      <select id="it-supplier">
        <option value="">— ${tt('Tiada')} —</option>
        ${db.suppliers.map(s=>`<option value="${s.id}" ${item.supplierId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-item" data-id="${item.id||''}">${t('btn_save')}</button>
    </div>
  `;
}

function supplierModalHTML(){
  return `
    <h2>${tt('Pembekal Baharu')}</h2>
    <div class="field"><label>${state.language==='en'?'Supplier Name':'Nama Pembekal'}</label><input id="sup-name" placeholder="Cth: Auto Parts Sdn Bhd"></div>
    <div class="field"><label>${state.language==='en'?'Phone No.':'No. Telefon'}</label><input id="sup-phone" placeholder="012-3456789"></div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-supplier">${t('btn_save')}</button>
    </div>
  `;
}

function poModalHTML(){
  return `
    <h2>${tt('Pesanan Belian Baharu')||'Pesanan Belian Baharu'}</h2>
    <div class="field"><label>${tt('Pembekal')}</label>
      <select id="po-supplier">
        <option value="">— ${state.language==='en'?'Select Supplier':'Pilih Pembekal'} —</option>
        ${db.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>${state.language==='en'?'Items (name:qty:cost, one per line)':'Item (nama:kuantiti:kos, satu setiap baris)'}</label>
      <textarea id="po-items" rows="4" placeholder="Minyak Enjin 5W-30:10:38&#10;Penapis Minyak:20:8"></textarea>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_cancel')}</button>
      <button class="btn btn-primary" data-action="save-po">${state.language==='en'?'Save Order':'Simpan Pesanan'}</button>
    </div>
  `;
}

