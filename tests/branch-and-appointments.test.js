// Branch switcher + per-branch filtering, plus appointments/contracts/staff
// CRUD and the settings-conflict warning (two sessions: one viewing Settings
// while the other writes a real change to shop_meta).
const { chromium } = require('playwright');
const { login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('branch-and-appointments');
  const browser = await chromium.launch();
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errorsA = [], errorsB = [];
  await login(pageA, 'A', errorsA);
  await login(pageB, 'B', errorsB);

  const role = await pageA.evaluate(() => state.currentStaff?.role);
  if(role !== 'Admin'){
    console.log('  (skipped: test account is not Admin — staff/settings checks require it)');
    await browser.close();
    return true;
  }

  await pageA.evaluate(() => {
    db.branches = db.branches.filter(b => b.name !== 'BA Branch');
    db.customers = db.customers.filter(c => c.name !== 'BA Customer');
    db.appointments = db.appointments.filter(a => a.notes !== 'BA appt');
    db.contracts = db.contracts.filter(c => c.label !== 'BA Contract');
    db.staff = db.staff.filter(s => s.email !== 'ba-staff@example.com');
    queueSave();
  });
  await pageA.waitForTimeout(1200);

  // ---- Branch switcher ----
  await pageA.evaluate(() => setState({ view: 'settings' }));
  await pageA.fill('#new-branch-name', 'BA Branch');
  await pageA.click('[data-action="add-branch"]');
  await pageA.waitForTimeout(600);
  const branchId = await pageA.evaluate(() => db.branches.find(b=>b.name==='BA Branch')?.id);
  r.checkTrue('second branch created, selector appears', await pageA.$('#branch-selector') !== null);

  await pageA.selectOption('#branch-selector', branchId);
  await pageA.waitForTimeout(200);
  await pageA.evaluate(() => setState({ view: 'customers' }));
  await pageA.click('[data-action="new-customer"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#cust-name', 'BA Customer');
  await pageA.fill('#cust-phone', '0170001111');
  await pageA.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(pageA);
  const custId = await pageA.evaluate(() => db.customers.find(c=>c.name==='BA Customer')?.id);

  await pageA.evaluate(() => setState({ view: 'jobs' }));
  await pageA.click('[data-action="new-job"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#nj-customer', custId);
  await pageA.waitForTimeout(200);
  await pageA.selectOption('#nj-vehicle', '__new__');
  await pageA.waitForTimeout(200);
  await pageA.fill('#nj-new-plate', 'BA 0001');
  await pageA.fill('#nj-desc', 'BA branch job');
  await pageA.click('[data-action="create-job"]');
  // Job creation awaits a real network round-trip (next_counter RPC for the
  // WS-#### number) before landing in db.jobs — poll instead of guessing a
  // fixed sleep covers that latency (see job-pos-invoice.test.js).
  await pageA.waitForFunction(() => db.jobs.some(j=>j.description==='BA branch job'), { timeout: 10000 }).catch(()=>{});
  r.check('new job tagged with the currently-selected branch', await pageA.evaluate(() => db.jobs.find(j=>j.description==='BA branch job')?.branchId), branchId);

  await pageA.evaluate(() => setState({ view: 'jobs' }));
  await pageA.waitForTimeout(200);
  r.checkTrue('job visible while viewing its own branch', await pageA.evaluate(() => document.body.textContent.includes('BA branch job')));
  await pageA.selectOption('#branch-selector', 'all');
  await pageA.waitForTimeout(200);
  r.checkTrue('job visible while viewing "all branches"', await pageA.evaluate(() => document.body.textContent.includes('BA branch job')));
  const mainBranchId = await pageA.evaluate(() => db.branches.find(b=>b.name!=='BA Branch')?.id);
  await pageA.selectOption('#branch-selector', mainBranchId);
  await pageA.waitForTimeout(200);
  r.checkTrue('job hidden while viewing a different branch', !(await pageA.evaluate(() => document.body.textContent.includes('BA branch job'))));
  await pageA.selectOption('#branch-selector', 'all');
  await pageA.waitForTimeout(200);

  // ---- Appointments ----
  await pageA.evaluate(() => setState({ view: 'appointments', apptTab: 'appointments' }));
  await pageA.click('[data-action="new-appointment"]');
  await pageA.waitForTimeout(300);
  await pageA.selectOption('#ap-customer', custId);
  await pageA.fill('#ap-date', '2026-08-15');
  await pageA.fill('#ap-time', '10:00');
  await pageA.fill('#ap-notes', 'BA appt');
  await pageA.click('[data-action="save-appointment"]');
  await pageA.waitForTimeout(1200);
  await pageB.evaluate(() => setState({ view: 'appointments', apptTab: 'appointments' }));
  let apptSynced = false;
  for(let i=0;i<10;i++){ apptSynced = await pageB.evaluate(() => db.appointments.some(a=>a.notes==='BA appt')); if(apptSynced) break; await pageB.waitForTimeout(1000); }
  r.checkTrue('appointment syncs to a second device', apptSynced);

  // ---- Contracts + generate invoice ----
  await pageA.evaluate(() => setState({ view: 'appointments', apptTab: 'contracts' }));
  await pageA.click('[data-action="new-contract"]');
  await pageA.waitForTimeout(300);
  await pageA.fill('#ct-label', 'BA Contract');
  await pageA.selectOption('#ct-customer', custId);
  await pageA.fill('#ct-freq', '30');
  await pageA.fill('#ct-items', 'BA Service:100');
  await pageA.click('[data-action="save-contract"]');
  await pageA.waitForTimeout(800);
  const contractId = await pageA.evaluate(() => db.contracts.find(c=>c.label==='BA Contract')?.id);
  await clickInPage(pageA, `[data-action="generate-contract"][data-id="${contractId}"]`);
  await pageA.waitForTimeout(1200);
  r.checkTrue('contract generates an invoice', await pageA.evaluate(() => db.invoices.some(inv=>inv.items?.some(it=>it.name==='BA Service'))));

  // ---- Staff CRUD ----
  await pageA.evaluate(() => setState({ view: 'staffpage', staffTab: 'staff' }));
  await pageA.click('[data-action="new-staff"]');
  await pageA.waitForTimeout(200);
  await pageA.fill('#sf-name', 'BA Staff');
  await pageA.selectOption('#sf-role', 'Mekanik').catch(()=>{});
  await pageA.fill('#sf-email', 'ba-staff@example.com');
  await pageA.click('[data-action="save-staff"]');
  await pageA.waitForTimeout(800);
  const staffId = await pageA.evaluate(() => db.staff.find(s=>s.email==='ba-staff@example.com')?.id);
  r.checkTrue('staff created', !!staffId);
  await waitForSyncIdle(pageA); // let this staff record's own creation echo settle before deleting it
  await clickInPage(pageA, `[data-action="delete-staff"][data-id="${staffId}"]`);
  await pageA.waitForTimeout(300);
  await clickInPage(pageA, '[data-action="confirm-yes"]');
  await pageA.waitForTimeout(800);
  r.checkTrue('staff deleted', !(await pageA.evaluate(() => db.staff.some(s=>s.email==='ba-staff@example.com'))));

  // ---- Settings conflict warning ----
  await pageB.evaluate(() => setState({ view: 'settings' }));
  await pageA.evaluate(() => setState({ view: 'settings' }));
  await pageA.waitForTimeout(200);
  const uniquePhone = '019-' + Date.now().toString().slice(-7);
  await pageA.fill('#set-shopphone', uniquePhone);
  await pageA.click('[data-action="save-settings"]');
  await pageA.waitForTimeout(500);
  let warningShown = false;
  for(let i=0;i<10;i++){
    warningShown = await pageB.evaluate(() => !!document.getElementById('settings-view')?.querySelector('.conflict-warning'));
    if(warningShown) break;
    await pageB.waitForTimeout(1000);
  }
  r.checkTrue('settings-conflict warning appears on the other session', warningShown);

  // Cleanup
  await pageA.evaluate(() => {
    db.branches = db.branches.filter(b => b.name !== 'BA Branch');
    db.customers = db.customers.filter(c => c.name !== 'BA Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'BA 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'BA branch job');
    db.appointments = db.appointments.filter(a => a.notes !== 'BA appt');
    db.contracts = db.contracts.filter(c => c.label !== 'BA Contract');
    db.invoices = db.invoices.filter(inv => !(inv.items?.some(it=>it.name==='BA Service')));
    queueSave();
  });
  await pageA.waitForTimeout(2000);

  r.checkEmpty('no console/page errors', [...errorsA, ...errorsB]);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
