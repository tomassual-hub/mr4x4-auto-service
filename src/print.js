/* ============================= PRINT INVOICE ============================= */
// Standard business invoice layout: letterhead (name/address/phone/SSM &
// SST reg. no.), a distinct invoice number + date block, a "Bill To"
// section, an itemized table with unit price separated from line amount,
// then subtotal/discount/tax/total — the fields any accountant or LHDN
// e-Invoice record-keeping check would expect to find, not just a receipt
// strip. paymentQR/thank-you footer kept from the original.
function printInvoice(inv){
  const c = getCustomer(inv.customerId);
  const v = getVehicle(inv.vehicleId);
  const s = db.settings;
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(s.shopName)}</h2>
          ${s.shopAddress ? `<div class="pi-addr">${esc(s.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          <div class="pi-addr">
            ${s.shopPhone ? esc(s.shopPhone) : ''}
            ${s.shopRegNo ? (s.shopPhone?' &middot; ':'')+(state.language==='en'?'Reg. No: ':'No. Pendaftaran: ')+esc(s.shopRegNo) : ''}
            ${s.shopSstNo ? '<br>'+(state.language==='en'?'SST No: ':'No. SST: ')+esc(s.shopSstNo) : ''}
          </div>
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${state.language==='en'?'INVOICE':'INVOIS'}</div>
          <div class="pi-row"><span>${state.language==='en'?'No.':'No. Invois'}</span><span>${esc(inv.invoiceNo)}</span></div>
          <div class="pi-row"><span>${state.language==='en'?'Date':'Tarikh'}</span><span>${fmtDateTime(inv.createdAt)}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${state.language==='en'?'Bill To':'Kepada'}</div>
        <div class="pi-billto-name">${c?esc(c.name):(state.language==='en'?'Walk-in Customer':'Pelanggan Walk-in')}</div>
        ${c && c.phone ? `<div class="pi-addr">${esc(c.phone)}</div>` : ''}
        ${v ? `<div class="pi-addr">${esc(v.plate)} — ${esc(v.model||'')}</div>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>${state.language==='en'?'Description':'Perkara'}</th><th style="text-align:center;">${state.language==='en'?'Qty':'Kuantiti'}</th><th style="text-align:right;">${state.language==='en'?'Unit Price':'Harga Seunit'}</th><th style="text-align:right;">${state.language==='en'?'Amount':'Jumlah'}</th></tr></thead>
        <tbody>
          ${inv.items.map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price)}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-totals">
        <div class="pi-row"><span>${state.language==='en'?'Subtotal':'Subjumlah'}</span><span>${fmtRM(inv.subtotal)}</span></div>
        ${inv.discount>0 ? `<div class="pi-row"><span>${state.language==='en'?'Discount':'Diskaun'}</span><span>-${fmtRM(inv.discount)}</span></div>` : ''}
        ${inv.tax>0 ? `<div class="pi-row"><span>SST (${inv.taxRate}%)</span><span>${fmtRM(inv.tax)}</span></div>` : ''}
        <div class="pi-row pi-total"><span>${state.language==='en'?'TOTAL':'JUMLAH'}</span><span>${fmtRM(inv.total)}</span></div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-row"><span>${state.language==='en'?'Payment Method':'Kaedah Bayaran'}</span><span>${esc(inv.payment)}</span></div>
      ${db.settings.paymentQR ? `
      <div style="text-align:center;margin-top:10px;">
        <img src="${db.settings.paymentQR}" alt="DuitNow QR" style="width:130px;height:130px;object-fit:contain;margin:6px auto;display:block;">
        <div style="font-size:11px;">${state.language==='en'?'Scan to pay (DuitNow)':'Imbas untuk bayar (DuitNow)'}</div>
      </div>` : ''}
      <div class="pi-foot">${state.language==='en'?'Thank you for your business.':'Terima kasih kerana menggunakan perkhidmatan kami.'}</div>
    </div>
  `;
  window.print();
}

function printJobCard(job){
  const c = getCustomer(job.customerId);
  const v = getVehicle(job.vehicleId);
  const statusLabel = {waiting:'Menunggu', progress:'Dalam Proses', done:'Siap', delivered:'Dihantar'}[job.status];
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">Kad Kerja Servis — Letak di Dashboard Kereta</div>
      <div class="pi-row"><span>No. Kad Kerja</span><span>${job.jobNo}</span></div>
      <div class="pi-row"><span>Tarikh Masuk</span><span>${fmtDateTime(job.createdAt)}</span></div>
      <div class="pi-row"><span>Status</span><span>${statusLabel}</span></div>
      <div class="pi-line"></div>
      <div class="pi-row"><span>Pelanggan</span><span>${c?esc(c.name):'-'}</span></div>
      ${v?`<div class="pi-row"><span>Kenderaan</span><span>${esc(v.plate)} (${esc(v.model)})</span></div>`:''}
      <div class="pi-row"><span>Mekanik</span><span>${esc(job.mechanic||'-')}</span></div>
      <div class="pi-line"></div>
      <div style="font-size:12px;margin-bottom:6px;"><strong>Penerangan Kerja:</strong></div>
      <div style="font-size:12.5px;margin-bottom:14px;">${esc(job.description||'-')}</div>
      <div class="pi-foot">${esc(db.settings.shopPhone||'')}</div>
    </div>
  `;
  window.print();
}

function printVehicleQR(v){
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice" style="text-align:center;">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">Label Kod QR Kenderaan</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(v.plate)}" width="180" height="180" alt="QR ${esc(v.plate)}" style="margin:14px auto;display:block;">
      <div style="font-size:20px;font-weight:700;letter-spacing:2px;">${esc(v.plate)}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">${esc(v.model||'')}</div>
    </div>
  `;
  window.print();
}

