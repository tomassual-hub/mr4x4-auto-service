/* ============================= PRINT INVOICE ============================= */
function printInvoice(inv){
  const c = getCustomer(inv.customerId);
  const v = getVehicle(inv.vehicleId);
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="pi-sub">Mr 4x4 Auto Service - Pakar Servis 4x4</div>
      <div class="pi-row"><span>No. Invois</span><span>${inv.invoiceNo}</span></div>
      <div class="pi-row"><span>Tarikh</span><span>${fmtDateTime(inv.createdAt)}</span></div>
      <div class="pi-row"><span>Pelanggan</span><span>${c?esc(c.name):'Walk-in'}</span></div>
      ${v?`<div class="pi-row"><span>Kenderaan</span><span>${esc(v.plate)} (${esc(v.model)})</span></div>`:''}
      <div class="pi-line"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Kuantiti</th><th>Harga</th></tr></thead>
        <tbody>
          ${inv.items.map(it=>`<tr><td>${esc(it.name)}</td><td>${it.qty}</td><td>${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-line"></div>
      <div class="pi-row"><span>Subjumlah</span><span>${fmtRM(inv.subtotal)}</span></div>
      ${inv.discount>0 ? `<div class="pi-row"><span>Diskaun</span><span>-${fmtRM(inv.discount)}</span></div>` : ''}
      ${inv.tax>0 ? `<div class="pi-row"><span>SST (${inv.taxRate}%)</span><span>${fmtRM(inv.tax)}</span></div>` : ''}
      <div class="pi-row pi-total"><span>JUMLAH</span><span>${fmtRM(inv.total)}</span></div>
      <div class="pi-row"><span>Kaedah Bayaran</span><span>${inv.payment}</span></div>
      ${db.settings.paymentQR ? `
      <div class="pi-line"></div>
      <div style="text-align:center;">
        <img src="${db.settings.paymentQR}" alt="DuitNow QR" style="width:130px;height:130px;object-fit:contain;margin:6px auto;display:block;">
        <div style="font-size:11px;">Imbas untuk bayar (DuitNow)</div>
      </div>` : ''}
      <div class="pi-foot">Terima kasih kerana menggunakan perkhidmatan kami.</div>
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
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(v.plate)}" width="180" height="180" style="margin:14px auto;display:block;">
      <div style="font-size:20px;font-weight:700;letter-spacing:2px;">${esc(v.plate)}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;">${esc(v.model||'')}</div>
    </div>
  `;
  window.print();
}

