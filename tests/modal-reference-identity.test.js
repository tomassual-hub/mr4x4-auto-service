// Regression guard for the realtime reference-identity fix: handleRemoteChange
// must merge into the existing db[key][idx] object (Object.assign), never
// replace it wholesale — otherwise an open edit modal's captured reference
// gets silently detached and its Save writes to an orphaned copy.
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('modal-reference-identity');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const jobId = await page.evaluate(() => {
    const id = uid();
    db.jobs.push({id, jobNo:'REF-TEST', customerId:null, vehicleId:null, description:'ref test job', mechanic:'', status:'waiting', items:[], createdAt:Date.now(), invoiced:false, createdBy:'', internalNote:'', doneAt:null, photos:[], branchId:db.branches[0].id});
    return id;
  });

  await page.evaluate((id) => {
    const job = db.jobs.find(j=>j.id===id);
    setState({ view: 'jobs', modal: { type: 'job-detail', job } });
  }, jobId);
  await page.waitForTimeout(200);

  const referenceCheck = await page.evaluate((id) => {
    const before = db.jobs.find(j=>j.id===id);
    // Simulate a realtime echo for this same record arriving while its
    // detail modal is open (this happens for real on the client's own
    // writes, not just other devices).
    handleRemoteChange('jobs', { eventType: 'UPDATE', new: { id, data: { ...before, description: 'echoed' } }, old: { id } });
    const after = db.jobs.find(j=>j.id===id);
    return { sameReference: state.modal.job === after, echoedDescription: state.modal.job.description };
  }, jobId);
  r.checkTrue('modal reference survives a realtime echo of its own record', referenceCheck.sameReference);
  r.check('echoed field is visible through the modal reference', referenceCheck.echoedDescription, 'echoed');

  await page.selectOption('#job-status-select', 'progress');
  await page.evaluate(() => { const btn = document.querySelector('[data-action="save-job-status"]'); if(btn) btn.click(); });
  await page.waitForTimeout(500);

  const finalStatus = await page.evaluate((id) => { const j = db.jobs.find(j=>j.id===id); return j ? j.status : null; }, jobId);
  r.check('status edit made after the echo actually persists to db.jobs', finalStatus, 'progress');

  await page.evaluate((id) => { db.jobs = db.jobs.filter(j=>j.id!==id); queueSave(); }, jobId);
  await page.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
