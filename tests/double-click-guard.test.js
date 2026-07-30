// Regression guard for a real bug: submit-style buttons (checkout,
// create-job) are async handlers that await a counter RPC before creating
// the record -- with no re-entrancy protection, two clicks landing before
// that RPC resolves (a fast double-click/double-tap, very plausible on a
// workshop tablet) used to run the whole handler twice, producing two
// invoices (inventory/loyalty deducted twice) or two job cards. Fixed via
// a guard in bindAction/bindAllAction (src/main.js). This test fires two
// synchronous .click() calls in the same browser task -- the closest a
// script can get to a real double-click landing before either handler's
// first await yields control back.
const { chromium } = require('playwright');
const { login, dismissDuplicateConfirm, waitForSyncIdle, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('double-click-guard');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  await login(page, 'A', errors);

  await page.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'DCG Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'DCG 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'DCG test job');
    db.inventory = db.inventory.filter(i => i.sku !== 'DCG-ITEM-1');
    db.invoices = db.invoices.filter(inv => inv.items && inv.items.some(it=>it.name==='DCG Test Item'));
    queueSave();
  });
  await page.waitForTimeout(1200);

  // ================= 1. Double-click checkout must only create ONE invoice =================
  await page.evaluate(() => setState({ view: 'inventory', invMainTab: 'items' }));
  await page.click('[data-action="new-item"]');
  await page.waitForTimeout(200);
  await page.fill('#it-name', 'DCG Test Item');
  await page.fill('#it-sku', 'DCG-ITEM-1');
  await page.fill('#it-qty', '10');
  await page.fill('#it-cost', '5');
  await page.fill('#it-price', '25');
  await page.fill('#it-low', '2');
  await page.click('[data-action="save-item"]');
  await page.waitForTimeout(800);
  await waitForSyncIdle(page);
  const itemId = await page.evaluate(() => db.inventory.find(i=>i.sku==='DCG-ITEM-1')?.id);
  r.checkTrue('inventory item created', !!itemId);

  await page.evaluate(() => setState({ view: 'pos' }));
  await page.waitForTimeout(200);
  await page.click(`[data-action="add-to-cart"][data-id="${itemId}"]`);
  await page.waitForTimeout(200);

  // Two synchronous .click() calls in one evaluate() -- both dispatch and
  // run their listeners' synchronous prologue (including the guard check)
  // before the browser yields back to this script, same as a real fast
  // double-click landing before the first call's counter RPC resolves.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="checkout"]');
    btn.click();
    btn.click();
  });
  await page.waitForFunction(() => db.invoices.some(inv => inv.items && inv.items.some(it=>it.name==='DCG Test Item')), { timeout: 10000 }).catch(()=>{});
  // Give a slow second call every chance to land if the guard failed.
  await page.waitForTimeout(2500);
  await waitForSyncIdle(page);

  const result = await page.evaluate(() => {
    const invs = db.invoices.filter(inv => inv.items && inv.items.some(it=>it.name==='DCG Test Item'));
    const item = db.inventory.find(i=>i.sku==='DCG-ITEM-1');
    return { invoiceCount: invs.length, itemQty: item?.qty };
  });
  r.check('exactly one invoice created despite two rapid clicks', result.invoiceCount, 1);
  r.check('inventory deducted only once (10-1=9)', result.itemQty, 9);

  // ================= 2. Double-click create-job must only create ONE job =================
  await page.evaluate(() => setState({ view: 'customers' }));
  await page.click('[data-action="new-customer"]');
  await page.waitForTimeout(200);
  await page.fill('#cust-name', 'DCG Customer');
  await page.fill('#cust-phone', '0161230099');
  await page.click('[data-action="save-customer"]');
  await dismissDuplicateConfirm(page);
  const custId = await page.evaluate(() => db.customers.find(c=>c.name==='DCG Customer')?.id);
  await waitForSyncIdle(page);

  await page.evaluate(() => setState({ view: 'jobs' }));
  await page.click('[data-action="new-job"]');
  await page.waitForTimeout(300);
  await page.selectOption('#nj-customer', custId);
  await page.waitForTimeout(200);
  await page.selectOption('#nj-vehicle', '__new__');
  await page.waitForTimeout(200);
  await page.fill('#nj-new-plate', 'DCG 0001');
  await page.fill('#nj-desc', 'DCG test job');

  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="create-job"]');
    btn.click();
    btn.click();
  });
  await page.waitForFunction(() => db.jobs.some(j=>j.description==='DCG test job'), { timeout: 10000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await waitForSyncIdle(page);

  const jobCount = await page.evaluate(() => db.jobs.filter(j=>j.description==='DCG test job').length);
  r.check('exactly one job card created despite two rapid clicks', jobCount, 1);

  // ---- cleanup ----
  await page.evaluate(() => {
    db.customers = db.customers.filter(c => c.name !== 'DCG Customer');
    db.vehicles = db.vehicles.filter(v => v.plate !== 'DCG 0001');
    db.jobs = db.jobs.filter(j => j.description !== 'DCG test job');
    db.inventory = db.inventory.filter(i => i.sku !== 'DCG-ITEM-1');
    db.invoices = db.invoices.filter(inv => !(inv.items && inv.items.some(it=>it.name==='DCG Test Item')));
    queueSave();
  });
  await page.waitForTimeout(1500);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
