// Shared helpers for the Playwright regression suite. Every test here runs
// against an isolated Supabase project (see build/build-test.js), never the
// production one the live shop uses — `npm run build:test` produces the
// exact HTML file appUrl() below points at. This isolation exists because a
// bug in a test WILL touch whatever backend it's pointed at for real: a
// restore-related bug earlier actually deleted the real shop's Admin staff
// record before this separation existed.
const path = require('path');

// example.com is RFC 2606 reserved and gets rejected outright by Supabase's
// email validator on this project (confirmed via direct signup attempts) —
// mailinator.com is a real, deliverable domain so it passes validation; no
// mail ever actually needs to be read there since email confirmation is off.
const TEST_EMAIL = process.env.MR4X4_TEST_EMAIL || 'sync-test-mr4x4@mailinator.com';
const TEST_PASSWORD = process.env.MR4X4_TEST_PASSWORD || 'SyncTest123!';

function appUrl(){
  const filePath = path.join(__dirname, '.test-build', 'ServisPro.html');
  return 'file:///' + filePath.replace(/\\/g, '/').replace(/ /g, '%20');
}

async function login(page, label, errors){
  if(errors){
    page.on('pageerror', e => errors.push(`${label} pageerror: ${e.message}`));
    page.on('console', msg => { if (msg.type()==='error') errors.push(`${label} console: ${msg.text()}`); });
  }
  await page.goto(appUrl());
  // checkOnboarding() is a fire-and-forget async call inside
  // handleAuthenticated() — it can set state.showOnboarding=true and
  // render() a blocking modal *after* login finishes, racing with whatever
  // the test does next. Pre-seed the flag it checks so onboarding never
  // triggers in the first place, rather than trying to out-wait the race.
  await page.evaluate(() => localStorage.setItem('bk_onboarding-seen', '1'));
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', TEST_EMAIL);
  await page.fill('#login-password', TEST_PASSWORD);
  await page.click('[data-action="do-login"]');
  // Wait for the actual condition tests depend on (a resolved staff record),
  // not just authBusy flipping false — under load (many tests hitting the
  // same Supabase project back to back) loadRemoteDB()/resolveStaffForUser()
  // can take noticeably longer than a short fixed sleep would allow for,
  // and a timed-out wait here used to silently continue anyway.
  await page.waitForFunction(() => !!state.currentStaff || !!state.loginError, { timeout: 30000 });
  if(await page.evaluate(() => !!state.loginError)){
    throw new Error('Login failed: ' + await page.evaluate(() => state.loginError));
  }
  await page.waitForTimeout(300);
  const skipBtn = await page.$('[data-action="onboarding-skip"]');
  if(skipBtn){ await skipBtn.click(); await page.waitForTimeout(300); }
}

// Clicks via document.querySelector inside the page instead of Playwright's
// ElementHandle.click() — a plain page.$() handle can go stale between the
// query and the click if a render() lands in between (confirmed to happen
// in this app when a confirm dialog follows a file-read or async save), so
// resolving the selector fresh at click time is the reliable way to do it.
async function clickInPage(page, selector){
  await page.evaluate((sel) => { const el = document.querySelector(sel); if(el) el.click(); }, selector);
}

// Waits for queueSave()'s debounced write to finish, plus a fixed buffer for
// that write's own realtime echo to round-trip back to this same client.
// Editing a record again before its own creation/update echo arrives is a
// real (if narrow) race: handleRemoteChange merges the echo's fields into
// the live object by reference (correct — see modal-reference-identity),
// but if the echo is *older* than an edit made in that gap, the merge can
// still overwrite the newer local edit with the stale echoed value. Real
// users rarely re-edit something within ~1s of creating it; test scripts
// do it constantly, so give the round-trip a chance to settle first.
async function waitForSyncIdle(page, { echoBufferMs = 1200 } = {}){
  await page.waitForFunction(() => state.syncStatus === 'idle', { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(echoBufferMs);
}

async function dismissDuplicateConfirm(page){
  await page.waitForTimeout(400);
  await clickInPage(page, '[data-action="confirm-yes"]');
  await page.waitForTimeout(400);
}

// Minimal assertion collector — a real test suite needs a non-zero exit
// code on failure (so `npm test` / CI can gate on it), not just console
// output for a human to eyeball.
function makeReporter(name){
  const results = [];
  return {
    name,
    check(desc, actual, expected){
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ desc, pass, actual, expected });
      const mark = pass ? 'PASS' : 'FAIL';
      console.log(`  [${mark}] ${desc}` + (pass ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`));
      return pass;
    },
    checkTrue(desc, actual){
      return this.check(desc, !!actual, true);
    },
    checkEmpty(desc, arr){
      const pass = Array.isArray(arr) && arr.length === 0;
      results.push({ desc, pass, actual: arr, expected: [] });
      console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${desc}` + (pass ? '' : ` — got ${JSON.stringify(arr)}`));
      return pass;
    },
    summary(){
      const failed = results.filter(r => !r.pass);
      console.log(`\n${name}: ${results.length - failed.length}/${results.length} checks passed`);
      return failed.length === 0;
    }
  };
}

module.exports = { TEST_EMAIL, TEST_PASSWORD, appUrl, login, clickInPage, dismissDuplicateConfirm, waitForSyncIdle, makeReporter };
