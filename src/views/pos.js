/* ============================= POS VIEW ============================= */
function viewPOS(){
  const cart = state.posCart;
  const subtotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
  let discountAmt = 0;
  if(state.posDiscountType==='percent') discountAmt = subtotal * (Number(state.posDiscountValue)||0) / 100;
  else discountAmt = Number(state.posDiscountValue)||0;
  discountAmt = Math.min(Math.max(discountAmt,0), subtotal);
  const afterDiscount = subtotal - discountAmt;
  const taxRate = Number(db.settings.taxRate)||0;
  const taxAmt = afterDiscount * taxRate/100;
  const total = afterDiscount + taxAmt;
  const custVehicles = state.posCustomerId ? getVehiclesFor(state.posCustomerId) : [];

  return `
  <div class="pos-wrap">
    <div class="panel">
      <h2>${ICONS.inventory} ${tt('Pilih Item / Servis')}</h2>
      <div class="field">
        <label>${ICONS.barcode} Imbas / Kod Pantas (SKU)</label>
        <input id="pos-barcode" placeholder="Imbas kod bar atau taip SKU, tekan Enter" autocomplete="off">
      </div>
      <div class="search-box">${ICONS.search}<input id="pos-search" placeholder="${tt('Cari item inventori...')}"></div>
      <div id="pos-item-list">${renderPOSItemList('')}</div>
      <div class="field" style="margin-top:14px;">
        <label>${tt('Atau Tambah Caj Servis Custom')}</label>
        <div style="display:flex;gap:8px;">
          <input id="pos-custom-name" placeholder="${tt('Nama servis')}" style="flex:2;">
          <input id="pos-custom-price" type="number" placeholder="RM" style="flex:1;">
          <button class="btn btn-outline btn-sm" data-action="add-custom-cart">${ICONS.plus}</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>${ICONS.pos} ${tt('Troli & Invois')}</h2>
      <div class="field"><label>${tt('Pelanggan (pilihan)')}</label>
        <select id="pos-customer">
          <option value="">${tt('Tunai / Walk-in')}</option>
          ${db.customers.map(c=>`<option value="${c.id}" ${state.posCustomerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      ${state.posCustomerId ? `
      <div class="field"><label>${tt('Kenderaan')}</label>
        <select id="pos-vehicle">
          <option value="">— ${tt('Tiada')} —</option>
          ${custVehicles.map(v=>`<option value="${v.id}" ${state.posVehicleId===v.id?'selected':''}>${esc(v.plate)} (${esc(v.model)})</option>`).join('')}
        </select>
      </div>
      ${(()=>{
        const cust = getCustomer(state.posCustomerId);
        const visits = cust ? (cust.visits||0) : 0;
        const threshold = Number(db.settings.loyaltyVisits)||5;
        if(visits>=threshold){
          return `<div style="background:rgba(242,167,59,.15);border:1px solid var(--accent);border-radius:8px;padding:10px 12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:12px;"><strong>⭐ ${state.language==='en'?'Loyal Customer':'Pelanggan Setia'}</strong><br><span style="color:var(--text-muted);">${visits} ${state.language==='en'?'visits · Qualifies for':'lawatan · Layak diskaun'} ${db.settings.loyaltyDiscount}%</span></div>
            <button class="btn btn-primary btn-sm" data-action="apply-loyalty-discount">${state.language==='en'?'Apply':'Guna'}</button>
          </div>`;
        }
        return `<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:14px;">${visits}/${threshold} ${state.language==='en'?'visits to loyalty discount':'lawatan ke diskaun setia'}</div>`;
      })()}` : ''}

      <div style="margin:14px 0;">
        ${cart.length===0 ? emptyState(tt('Troli kosong. Pilih item di sebelah kiri.')) : cart.map((c,idx)=>`
          <div class="cart-row">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${esc(c.name)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);">${fmtRM(c.price)} × ${c.qty}</div>
            </div>
            <button class="qty-btn" data-action="cart-dec" data-idx="${idx}">−</button>
            <span style="width:20px;text-align:center;font-family:'IBM Plex Mono',monospace;">${c.qty}</span>
            <button class="qty-btn" data-action="cart-inc" data-idx="${idx}">+</button>
            <button class="btn-icon" data-action="cart-remove" data-idx="${idx}">${ICONS.x}</button>
          </div>`).join('')}
      </div>

      <div class="field-row">
        <div class="field"><label>${tt('Diskaun')}</label>
          <select id="pos-discount-type">
            <option value="flat" ${state.posDiscountType==='flat'?'selected':''}>${tt('RM (Tetap)')}</option>
            <option value="percent" ${state.posDiscountType==='percent'?'selected':''}>${tt('% Peratus')}</option>
          </select>
        </div>
        <div class="field"><label>${tt('Nilai Diskaun')}</label><input id="pos-discount-value" type="number" min="0" value="${state.posDiscountValue||0}"></div>
      </div>

      <div class="receipt">
        <div class="receipt-row"><span>${tt('Subjumlah')}</span><span>${fmtRM(subtotal)}</span></div>
        ${discountAmt>0 ? `<div class="receipt-row"><span>${tt('Diskaun')}</span><span>-${fmtRM(discountAmt)}</span></div>` : ''}
        ${taxRate>0 ? `<div class="receipt-row"><span>SST (${taxRate}%)</span><span>${fmtRM(taxAmt)}</span></div>` : ''}
        <div class="receipt-line"></div>
        <div class="receipt-row receipt-total"><span>${tt('JUMLAH')}</span><span>${fmtRM(total)}</span></div>
      </div>
      <div class="field" style="margin-top:14px;"><label>${tt('Kaedah Bayaran')}</label>
        <select id="pos-payment">
          <option value="Tunai">${tt('Tunai')}</option>
          <option value="Kad">${tt('Kad Debit/Kredit')}</option>
          <option value="Online">${tt('Pemindahan Online / QR')}</option>
        </select>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" data-action="checkout" ${cart.length===0?'disabled':''}>${ICONS.pos} ${tt('Jana Invois & Selesai')}</button>
      <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:6px;">${tt('Petua: Ctrl+Enter untuk checkout pantas')}</div>
    </div>
  </div>

  <div class="panel" style="margin-top:20px;">
    <h2>${tt('Sejarah Invois')} <span class="tag">${db.invoices.length}</span></h2>
    ${db.invoices.length===0 ? emptyState(tt('Belum ada invois dikeluarkan.')) : `
    <div class="table-wrap"><table>
      <thead><tr><th>${tt('No. Invois')}</th><th>${tt('Pelanggan')}</th><th>${tt('Tarikh')}</th><th>${tt('Bayaran')}</th><th>${tt('Jumlah')}</th><th></th></tr></thead>
      <tbody>
        ${[...db.invoices].sort((a,b)=>b.createdAt-a.createdAt).slice(0,10).map(inv=>{
          const c = getCustomer(inv.customerId);
          const waText = encodeURIComponent(`Salam ${c?c.name:''}, berikut invois ${inv.invoiceNo} bernilai ${fmtRM(inv.total)} daripada ${db.settings.shopName}. Terima kasih!`);
          const waHref = c && c.phone ? `https://wa.me/${normalizePhone(c.phone)}?text=${waText}` : null;
          return `<tr>
            <td style="font-family:'IBM Plex Mono',monospace;">${inv.invoiceNo}</td>
            <td>${c?esc(c.name):tt('Walk-in')}</td>
            <td>${fmtDateTime(inv.createdAt)}</td>
            <td>${inv.payment}</td>
            <td style="color:var(--accent);font-weight:600;">${fmtRM(inv.total)}</td>
            <td style="white-space:nowrap;">
              <button class="btn-icon" data-action="print-invoice" data-id="${inv.id}" title="Cetak invois">${ICONS.printer}</button>
              ${waHref ? `<a class="btn-icon" href="${waHref}" target="_blank" rel="noopener" title="Hantar via WhatsApp" style="display:inline-flex;">${ICONS.whatsapp}</a>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`}
  </div>

  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.gauge} ${tt('Tutup Kunci Tunai Harian')}</h2>
    ${(()=>{
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayCash = db.invoices.filter(inv=>inv.createdAt>=todayStart.getTime() && inv.payment==='Tunai').reduce((s,i)=>s+i.total,0);
      const alreadyClosed = db.cashClosures.find(cc=>cc.date===localDateStr(todayStart));
      if(alreadyClosed){
        const variance = alreadyClosed.actual - alreadyClosed.expected;
        return `<div style="font-size:13px;">
          <div>${tt('Jangkaan tunai')}: <strong>${fmtRM(alreadyClosed.expected)}</strong></div>
          <div>${tt('Tunai dikira')}: <strong>${fmtRM(alreadyClosed.actual)}</strong></div>
          <div style="color:${variance===0?'var(--success)':'var(--danger)'};font-weight:600;margin-top:6px;">
            ${variance===0 ? '✓ '+tt('Padan sepenuhnya') : (variance>0 ? tt('Lebihan')+' '+fmtRM(variance) : tt('Kekurangan')+' '+fmtRM(Math.abs(variance)))}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">${tt('Ditutup oleh')} ${alreadyClosed.closedBy} ${tt('pada')} ${fmtDateTime(alreadyClosed.closedAt)}</div>
        </div>`;
      }
      return `
        <div style="font-size:13px;margin-bottom:10px;">${tt('Jualan tunai sistem hari ini')}: <strong style="color:var(--accent);">${fmtRM(todayCash)}</strong></div>
        <div class="field"><label>${tt('Jumlah Tunai Dikira Sebenar (RM)')}</label><input id="cash-actual" type="number" step="0.01" placeholder="0.00"></div>
        <button class="btn btn-primary" data-action="close-cash">${tt('Tutup Kunci Hari Ini')}</button>
      `;
    })()}
  </div>
  `;
}

function renderPOSItemList(filter){
  const items = db.inventory.filter(i=>i.name.toLowerCase().includes((filter||'').toLowerCase()));
  if(items.length===0) return emptyState('Tiada item sepadan.');
  return items.map(i=>`
    <div class="pos-item" data-action="add-to-cart" data-id="${i.id}">
      <div>
        <div class="n">${esc(i.name)}</div>
        <div class="m">Baki: ${i.qty} ${i.qty<=i.lowStock?'⚠️':''}</div>
      </div>
      <div class="p">${fmtRM(i.price)}</div>
    </div>`).join('');
}

