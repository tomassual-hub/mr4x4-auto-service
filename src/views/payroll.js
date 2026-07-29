/* ============================= PAYROLL ============================= */
// A ledger, not a payment processor -- same pattern as POS "payment method"
// or the DuitNow QR: real money moves outside this app (bank transfer, cash,
// etc.), this only calculates what's owed and records that it was paid.
// Deliberately does NOT calculate EPF/SOCSO/EIS/PCB -- getting Malaysian
// statutory payroll deductions wrong has real legal/tax consequences, and
// this is a small-shop convenience tool, not licensed payroll software.
function currentMonthStr(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function monthLabel(monthStr){
  const [y,m] = monthStr.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('ms-MY', {month:'long', year:'numeric'});
}

function shiftMonth(monthStr, delta){
  const [y,m] = monthStr.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Commission math mirrors viewReports()'s mechanic-performance calculation
// exactly (job.mechanic name match, invoice total attributed to that
// mechanic's jobs) — just scoped to a calendar month instead of "last N days".
function computeMonthlyPay(staffMember, month){
  const [y,m] = month.split('-').map(Number);
  const periodStart = new Date(y, m-1, 1).getTime();
  const periodEnd = new Date(y, m, 1).getTime();
  const baseSalary = Number(staffMember.baseSalary)||0;
  const jobsById = new Map(db.jobs.map(j=>[j.id, j]));
  let commissionRevenue = 0;
  db.invoices.forEach(inv=>{
    if(inv.createdAt<periodStart || inv.createdAt>=periodEnd) return;
    if(!inv.jobId) return;
    const job = jobsById.get(inv.jobId);
    if(job && job.mechanic===staffMember.name) commissionRevenue += inv.total;
  });
  const commissionPct = Number(staffMember.commissionPercent)||0;
  const commission = commissionRevenue*commissionPct/100;
  return { baseSalary, commissionRevenue, commissionPct, commission, total: baseSalary+commission };
}

function viewPayroll(){
  const en = state.language==='en';
  const month = state.payrollMonth || currentMonthStr();
  const isCurrentMonth = month === currentMonthStr();

  const rows = db.staff.map(s=>({
    staff: s,
    pay: computeMonthlyPay(s, month),
    record: db.payrollRecords.find(r=>r.staffId===s.id && r.month===month),
  }));

  const history = [...db.payrollRecords].sort((a,b)=>b.paidAt-a.paidAt).slice(0,20);

  return `
  <div class="section-head">
    <div><div class="sub">${en?'Calculate and record monthly staff pay':'Kira dan rekod gaji staf bulanan'}</div></div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button class="btn-icon" data-action="payroll-prev-month" title="${en?'Previous month':'Bulan sebelum'}" style="font-size:18px;">‹</button>
      <div style="font-weight:700;font-size:15px;min-width:150px;text-align:center;">${monthLabel(month)}</div>
      <button class="btn-icon" data-action="payroll-next-month" title="${en?'Next month':'Bulan seterusnya'}" style="font-size:18px;" ${isCurrentMonth?'disabled':''}>›</button>
    </div>
  </div>

  <div style="background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:12px;color:var(--text-muted);">
    ${en
      ? '<strong>Note:</strong> this calculates gross pay (base salary + commission) only. It does NOT calculate EPF/SOCSO/EIS/PCB statutory deductions — handle those separately per LHDN/KWSP/PERKESO requirements.'
      : '<strong>Nota:</strong> ini kira gaji kasar (gaji pokok + komisen) sahaja. Potongan statutori KWSP/PERKESO/EIS/PCB <u>TIDAK</u> dikira di sini — uruskan berasingan mengikut keperluan LHDN/KWSP/PERKESO.'}
  </div>

  <div class="grid grid-3">
    ${rows.length===0 ? emptyState(en?'No staff yet.':'Belum ada staf.') : rows.map(({staff, pay, record})=>`
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-weight:700;">${esc(staff.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${esc(staff.role)}</div>
          </div>
          ${record ? `<span class="pill pill-done">${en?'Paid':'Dibayar'}</span>` : `<span class="pill pill-wait">${en?'Unpaid':'Belum Dibayar'}</span>`}
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Base Salary':'Gaji Pokok'}</span><span>${fmtRM(pay.baseSalary)}</span></div>
        <div style="font-size:12.5px;color:var(--text-muted);display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Commission':'Komisen'} (${pay.commissionPct}%)</span><span>${fmtRM(pay.commission)}</span></div>
        <div style="font-weight:700;color:var(--accent);display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);"><span>${en?'Total':'Jumlah'}</span><span>${fmtRM(pay.total)}</span></div>
        ${record
          ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${en?'Paid':'Dibayar'} ${fmtDateTime(record.paidAt)} ${en?'by':'oleh'} ${esc(record.paidBy)}</div>
             <div style="display:flex;gap:8px;margin-top:8px;">
               <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" data-action="print-payslip" data-id="${record.id}">${ICONS.printer} ${en?'Payslip':'Penyata'}</button>
               <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" data-action="undo-payroll-payment" data-id="${record.id}">${en?'Undo':'Batal Rekod'}</button>
             </div>`
          : `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:10px;justify-content:center;" data-action="mark-payroll-paid" data-staffid="${staff.id}">${en?'Mark as Paid':'Tandakan Dibayar'}</button>`}
      </div>`).join('')}
  </div>

  <div class="panel" style="margin-top:20px;">
    <h2>${ICONS.history} ${en?'Payment History':'Sejarah Bayaran'}</h2>
    ${history.length===0 ? emptyState(en?'No payments recorded yet.':'Belum ada bayaran direkod.') : `
    <div class="table-wrap"><table>
      <thead><tr><th>${en?'Staff':'Staf'}</th><th>${en?'Month':'Bulan'}</th><th>${en?'Total':'Jumlah'}</th><th>${en?'Paid At':'Tarikh Bayar'}</th><th>${en?'By':'Oleh'}</th><th></th></tr></thead>
      <tbody>
        ${history.map(r=>`
          <tr>
            <td style="font-weight:600;">${esc(r.staffName)}</td>
            <td>${monthLabel(r.month)}</td>
            <td style="color:var(--accent);font-weight:600;">${fmtRM(r.total)}</td>
            <td>${fmtDateTime(r.paidAt)}</td>
            <td>${esc(r.paidBy)}</td>
            <td><button class="btn-icon" data-action="print-payslip" data-id="${r.id}" title="${en?'Print payslip':'Cetak penyata'}">${ICONS.printer}</button></td>
          </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
  `;
}
