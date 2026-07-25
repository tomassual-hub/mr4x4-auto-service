// Regression guard for the stored-XSS fix: every user-controlled field must
// render through esc() before hitting innerHTML. A crafted <img onerror>
// payload must never execute, no matter which view displays it.
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('xss-escaping');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const payload = '<img src=x onerror="window.__xssPoc = (window.__xssPoc||0)+1">';

  const result = await page.evaluate((name) => {
    window.__xssPoc = 0;
    const jobId = uid(), itemId = uid(), custId = uid();
    db.customers.push({ id: custId, name, phone: '0100000000', visits: 0 });
    db.jobs.push({ id: jobId, jobNo: 'XSS-TEST', customerId: null, vehicleId: null, description: name, mechanic: name, internalNote: name, status: 'waiting', items: [], createdAt: Date.now(), invoiced: false, createdBy: '', doneAt: null, photos: [], branchId: db.branches[0].id });
    db.inventory.push({ id: itemId, name: name, sku: name, qty: 5, cost: 1, price: 2, lowStock: 1, supplierId: null });
    logAudit('Ujian XSS', name);

    setState({ view: 'customers' });
    const afterCustomers = window.__xssPoc;
    setState({ view: 'pos' }); // customer <option> dropdown re-render
    const afterPos = window.__xssPoc;
    setState({ view: 'jobs' });
    const afterJobs = window.__xssPoc;
    setState({ view: 'inventory', invMainTab: 'items' });
    const afterInventory = window.__xssPoc;
    setState({ view: 'staffpage', staffTab: 'audit' });
    const afterAudit = window.__xssPoc;
    const job = db.jobs.find(j=>j.id===jobId);
    setState({ view: 'jobs', modal: { type: 'job-detail', job } });
    const afterJobModal = window.__xssPoc;
    setState({ modal: null });

    db.customers = db.customers.filter(c => c.id !== custId);
    db.jobs = db.jobs.filter(j => j.id !== jobId);
    db.inventory = db.inventory.filter(i => i.id !== itemId);
    db.auditLog = db.auditLog.filter(l => l.detail !== name);
    return { afterCustomers, afterPos, afterJobs, afterInventory, afterAudit, afterJobModal };
  }, payload);

  r.check('customer list view', result.afterCustomers, 0);
  r.check('POS customer dropdown', result.afterPos, 0);
  r.check('jobs list view', result.afterJobs, 0);
  r.check('inventory view', result.afterInventory, 0);
  r.check('audit log view', result.afterAudit, 0);
  r.check('job detail modal (description/mechanic fields)', result.afterJobModal, 0);

  await page.evaluate(() => queueSave());
  await page.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', errors);

  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
