// End-to-end coverage for Bay Management (workshop lift/station tracking,
// optionally assigned to a job) and the Dashboard's new Monthly Target
// rings + Bookings/Completed/Attendance "Today" stat cards.
const { chromium } = require('playwright');
const { login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('bay-and-targets');
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsA = [];
  await login(pageA, 'A', errorsA);
  // Force English so DOM label lookups below are deterministic regardless
  // of this account's saved language preference.
  await pageA.evaluate(() => { state.language = 'en'; render(); });

  await pageA.evaluate(() => {
    db.bays = (db.bays||[]).filter(b => !b.name.startsWith('NFB3'));
    db.customers = db.customers.filter(c => c.name !== 'NFB3 Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'NFB3 0001');
    db.jobs = db.jobs.filter(j => !(j.description||'').includes('NFB3'));
    db.appointments = db.appointments.filter(a => a.notes !== 'NFB3 appt');
    db.staff = db.staff.filter(s => s.name !== 'NFB3 Test Staff');
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('NFB3')));
    queueSave();
  });
  await pageA.waitForTimeout(1500);

  // ================= 1. Bay Management CRUD =================
  await pageA.evaluate(() => setState({ view: 'settings' }));
  await pageA.click('[data-action="new-bay"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#bay-name', 'NFB3 Bay 1');
  await pageA.fill('#bay-category', 'General Repair');
  await pageA.click('[data-action="save-bay"]');
  await pageA.waitForTimeout(600);
  const bayId = await pageA.evaluate(() => (db.bays||[]).find(b=>b.name==='NFB3 Bay 1')?.id);
  r.checkTrue('bay created', !!bayId);
  const bayAfterCreate = await pageA.evaluate((id) => (db.bays||[]).find(b=>b.id===id), bayId);
  r.check('bay defaults to active', bayAfterCreate?.active, true);
  await waitForSyncIdle(pageA);

  await clickInPage(pageA, `[data-action="toggle-bay-active"][data-id="${bayId}"]`);
  await pageA.waitForTimeout(400);
  const bayAfterToggle = await pageA.evaluate((id) => (db.bays||[]).find(b=>b.id===id)?.active, bayId);
  r.check('bay toggled inactive', bayAfterToggle, false);
  await waitForSyncIdle(pageA);
  await clickInPage(pageA, `[data-action="toggle-bay-active"][data-id="${bayId}"]`);
  await pageA.waitForTimeout(400);
  await waitForSyncIdle(pageA);
  const bayReactivated = await pageA.evaluate((id) => (db.bays||[]).find(b=>b.id===id)?.active, bayId);
  r.check('bay toggled back to active', bayReactivated, true);

  await clickInPage(pageA, `[data-action="edit-bay"][data-id="${bayId}"]`);
  await pageA.waitForTimeout(300);
  await pageA.fill('#bay-category', 'Body Repair');
  await pageA.click('[data-action="save-bay"]');
  await pageA.waitForTimeout(600);
  const bayAfterEdit = await pageA.evaluate((id) => (db.bays||[]).find(b=>b.id===id)?.category, bayId);
  r.check('bay category edited', bayAfterEdit, 'Body Repair');
  await waitForSyncIdle(pageA);

  // ================= 2. Assign bay to a job, verify occupancy shows on the bay card =================
  await pageA.evaluate(() => setState({ view: 'customers' }));
  await pageA.click('[data-action="new-customer"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#cust-name', 'NFB3 Customer');
  await pageA.fill('#cust-phone', '0161119999');
  await pageA.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(pageA);
  const custId = await pageA.evaluate(() => db.customers.find(c=>c.name==='NFB3 Customer')?.id);

  await pageA.evaluate(() => setState({ view: 'jobs' }));
  await pageA.click('[data-action="new-job"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#nj-customer', custId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#nj-vehicle', '__new__');
  await pageA.waitForTimeout(200);
  await pageA.fill('#nj-new-plate', 'NFB3 0001');
  await pageA.fill('#nj-desc', 'NFB3 bay job');
  await pageA.selectOption('#nj-bay', bayId);
  await pageA.click('[data-action="create-job"]');
  await pageA.waitForFunction(() => db.jobs.some(j=>j.description==='NFB3 bay job'), { timeout: 10000 }).catch(()=>{});
  const jobId = await pageA.evaluate(() => db.jobs.find(j=>j.description==='NFB3 bay job')?.id);
  r.checkTrue('job created', !!jobId);
  const jobBayId = await pageA.evaluate((id) => db.jobs.find(j=>j.id===id)?.bayId, jobId);
  r.check('job assigned to the bay chosen at creation', jobBayId, bayId);
  await waitForSyncIdle(pageA);

  await pageA.evaluate(() => setState({ view: 'settings' }));
  await pageA.waitForTimeout(300);
  const occupancy = await pageA.evaluate((id) => {
    const card = Array.from(document.querySelectorAll('.panel')).find(p => p.querySelector('h2') && p.querySelector('h2').textContent.includes('Bay Management'));
    if(!card) return null;
    const bayCards = Array.from(card.querySelectorAll('.grid.grid-4 > .panel'));
    const target = bayCards.find(c => c.textContent.includes('NFB3 Bay 1'));
    return target ? target.textContent : null;
  }, bayId);
  r.checkTrue('bay card shows job no. when occupied', !!occupancy && occupancy.includes(await pageA.evaluate((id)=>db.jobs.find(j=>j.id===id)?.jobNo, jobId)));

  // ================= 3. Dashboard: Monthly Target rings =================
  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await pageA.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await pageA.click('[data-action="new-item"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#it-name', 'NFB3 Target Item');
  await pageA.fill('#it-sku', 'NFB3-TARGET');
  await pageA.fill('#it-qty', '5');
  await pageA.fill('#it-cost', '10');
  await pageA.fill('#it-price', '100');
  await pageA.fill('#it-low', '1');
  await pageA.click('[data-action="save-item"]');
  await pageA.waitForTimeout(600);
  await waitForSyncIdle(pageA);
  const targetItemId = await pageA.evaluate(() => db.inventory.find(i=>i.sku==='NFB3-TARGET')?.id);

  await pageA.evaluate(() => setState({ view: 'pos' }));
  await pageA.waitForTimeout(200);
  await clickInPage(pageA, `[data-action="add-to-cart"][data-id="${targetItemId}"]`);
  await pageA.waitForTimeout(200);
  await pageA.click('[data-action="checkout"]');
  await pageA.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='NFB3 Target Item')), { timeout: 10000 }).catch(()=>{});
  await waitForSyncIdle(pageA);

  // Set the target to exactly match this month's actual totals (computed
  // the same way the dashboard does) so the resulting ring % is
  // deterministic regardless of other invoices already in this shared
  // test project this month.
  const monthActuals = await pageA.evaluate(() => {
    const monthKey = currentMonthStr();
    const monthInvoices = db.invoices.filter(inv=>{
      const d = new Date(inv.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===monthKey;
    });
    return { sales: monthInvoices.reduce((s,i)=>s+i.total,0), units: monthInvoices.length };
  });
  r.checkTrue('this month has at least the invoice just created', monthActuals.units>=1 && monthActuals.sales>=100);

  await pageA.evaluate(() => setState({ view: 'settings' }));
  await pageA.waitForTimeout(200);
  await pageA.fill('#set-sales-target', String(monthActuals.sales));
  await pageA.fill('#set-unit-target', String(monthActuals.units));
  await pageA.click('[data-action="save-settings"]');
  await pageA.waitForTimeout(600);
  await waitForSyncIdle(pageA);

  await pageA.evaluate(() => setState({ view: 'dashboard' }));
  await pageA.waitForTimeout(300);
  const ringPcts = await pageA.evaluate(() => Array.from(document.querySelectorAll('.progress-ring-pct')).map(el=>el.textContent));
  r.checkTrue('monthly target panel shows two 100% rings (target set to exact actuals)', ringPcts.length===2 && ringPcts.every(p=>p==='100%'));

  // ================= 4. Dashboard: Bookings/Completed/Attendance Today =================
  const readStat = async (label) => {
    return await pageA.evaluate((lbl) => {
      const card = Array.from(document.querySelectorAll('.stat-card')).find(c => c.querySelector('.stat-label') && c.querySelector('.stat-label').textContent.trim()===lbl);
      return card ? card.querySelector('.stat-value').textContent.trim() : null;
    }, label);
  };

  const bookingsBefore = Number(await readStat('Bookings Today'));
  await pageA.evaluate(() => setState({ view: 'appointments' }));
  await pageA.click('[data-action="new-appointment"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#ap-customer', custId);
  await pageA.waitForTimeout(200);
  const todayStr = await pageA.evaluate(() => localDateStr());
  await pageA.fill('#ap-date', todayStr);
  await pageA.fill('#ap-time', '15:00');
  await pageA.fill('#ap-notes', 'NFB3 appt');
  await pageA.click('[data-action="save-appointment"]');
  await pageA.waitForFunction(() => db.appointments.some(a=>a.notes==='NFB3 appt'), { timeout: 10000 }).catch(()=>{});
  await waitForSyncIdle(pageA);
  await pageA.evaluate(() => setState({ view: 'dashboard' }));
  await pageA.waitForTimeout(300);
  const bookingsAfter = Number(await readStat('Bookings Today'));
  r.check('Bookings Today increments after a same-day appointment is created', bookingsAfter, bookingsBefore+1);

  const completedBefore = Number(await readStat('Completed Today'));
  await pageA.evaluate((id) => { const job = db.jobs.find(j=>j.id===id); setState({ view:'jobs', modal:{type:'job-detail', job} }); }, jobId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#job-status-select', 'done');
  await pageA.click('[data-action="save-job-status"]');
  await pageA.waitForTimeout(500);
  await waitForSyncIdle(pageA);
  await pageA.evaluate(() => setState({ view: 'dashboard' }));
  await pageA.waitForTimeout(300);
  const completedAfter = Number(await readStat('Completed Today'));
  r.check('Completed Today increments after a job is marked done', completedAfter, completedBefore+1);

  const attendanceBefore = await readStat('Attendance Today');
  await pageA.evaluate(() => setState({ view: 'staffpage' }));
  await pageA.click('[data-action="new-staff"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#sf-name', 'NFB3 Test Staff');
  await pageA.selectOption('#sf-role', 'Mekanik');
  await pageA.fill('#sf-email', 'nfb3-test-staff@mailinator.com');
  await pageA.click('[data-action="save-staff"]');
  await pageA.waitForTimeout(600);
  const staffId = await pageA.evaluate(() => db.staff.find(s=>s.name==='NFB3 Test Staff')?.id);
  r.checkTrue('extra staff created for attendance check', !!staffId);
  await waitForSyncIdle(pageA);
  await pageA.evaluate(async (id) => {
    const { data, error } = await supabaseClient.rpc('attendance_punch', { p_staff_id: id, p_token: 'DIRECT_TEST_PUNCH' });
  }, staffId);
  // The staff record has no attendanceToken set yet (never opened the QR
  // modal), so a punch with any token should be rejected -- confirms the
  // RPC still fails closed even from this test's own direct RPC call.
  const attendanceStillNull = await pageA.evaluate((id) => (db.attendance||[]).some(a=>a.staffId===id), staffId);
  r.check('punch with no matching token is rejected (fails closed)', attendanceStillNull, false);

  await clickInPage(pageA, `[data-action="show-attendance-qr"][data-id="${staffId}"]`);
  await pageA.waitForTimeout(300);
  const realToken = await pageA.evaluate((id) => db.staff.find(s=>s.id===id)?.attendanceToken, staffId);
  await pageA.click('[data-action="close-modal"]');
  await pageA.waitForTimeout(200);
  await waitForSyncIdle(pageA);
  await pageA.evaluate(async (args) => {
    await supabaseClient.rpc('attendance_punch', { p_staff_id: args.id, p_token: args.token });
  }, { id: staffId, token: realToken });
  await pageA.waitForFunction((id) => (db.attendance||[]).some(a=>a.staffId===id), staffId, { timeout: 10000 }).catch(()=>{});
  await waitForSyncIdle(pageA);
  await pageA.evaluate(() => setState({ view: 'dashboard' }));
  await pageA.waitForTimeout(300);
  const attendanceAfter = await readStat('Attendance Today');
  const [presentBefore, totalBefore] = attendanceBefore.split('/').map(Number);
  const [presentAfter, totalAfter] = attendanceAfter.split('/').map(Number);
  r.check('Attendance Today total increments (new staff added)', totalAfter, totalBefore+1);
  r.check('Attendance Today present count increments (punched in)', presentAfter, presentBefore+1);

  // ---- cleanup ----
  await pageA.evaluate((jobId) => {
    db.bays = (db.bays||[]).filter(b => !b.name.startsWith('NFB3'));
    db.customers = db.customers.filter(c => c.name !== 'NFB3 Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'NFB3 0001');
    db.jobs = db.jobs.filter(j => !(j.description||'').includes('NFB3'));
    db.appointments = db.appointments.filter(a => a.notes !== 'NFB3 appt');
    db.staff = db.staff.filter(s => s.name !== 'NFB3 Test Staff');
    db.attendance = (db.attendance||[]).filter(a => a.staffName !== 'NFB3 Test Staff');
    db.inventory = db.inventory.filter(i => i.sku !== 'NFB3-TARGET');
    db.invoices = db.invoices.filter(inv => !(inv.items||[]).some(it=>(it.name||'').startsWith('NFB3')));
    db.settings.monthlySalesTarget = 0;
    db.settings.monthlyUnitTarget = 0;
    queueSave();
  }, jobId);
  await pageA.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', errorsA);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
