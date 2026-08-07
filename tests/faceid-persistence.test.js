// Regression guard for a real complaint: logout used to call clearFaceId()
// unconditionally, silently disabling Face ID quick-unlock and forcing
// re-enrollment on every single login even on the user's own phone. Face ID
// only ever gates an EXISTING persisted session on this device (see the
// header comment in src/face-id.js) -- signOut() already destroys that
// session, so there's nothing left for a stale enrollment to grant access
// to, and session-restore already re-checks enrolled.email against whoever
// is actually logging back in (see sync-engine.js). The explicit "Turn Off"
// button in Face ID settings (remove-faceid) is the only thing that should
// clear an enrollment now.
const { chromium } = require('playwright');
const { login, TEST_EMAIL, makeReporter } = require('./helpers');

const FACE_ID_KEY = 'bk_faceid_v1';

async function run(){
  const r = makeReporter('faceid-persistence');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  // Seed a fake enrollment directly -- this test cares about what logout
  // DOES with an existing enrollment, not the real WebAuthn ceremony (which
  // needs actual platform-authenticator hardware/CDP virtual-authenticator
  // setup, orthogonal to what changed here).
  await page.evaluate((email) => {
    localStorage.setItem('bk_faceid_v1', JSON.stringify({ email, credentialId: 'fake-cred-id-for-test' }));
  }, TEST_EMAIL);

  await page.click('[data-action="logout"]');
  await page.waitForFunction(() => !state.currentStaff, { timeout: 10000 });

  const enrollmentAfterLogout = await page.evaluate((key) => localStorage.getItem(key), FACE_ID_KEY);
  r.checkTrue('Face ID enrollment survives logout', !!enrollmentAfterLogout);
  r.check('survived enrollment still matches the original account', enrollmentAfterLogout && JSON.parse(enrollmentAfterLogout).email, TEST_EMAIL);

  // Explicit removal (the "Turn Off" button's handler) must still clear it --
  // called directly since the sidebar button itself is gated behind
  // faceIdSupportedSync() (real mobile + platform authenticator detection),
  // not something a plain desktop Playwright browser satisfies.
  await page.evaluate(() => { clearFaceId(); });
  const enrollmentAfterExplicitRemove = await page.evaluate((key) => localStorage.getItem(key), FACE_ID_KEY);
  r.check('explicit clearFaceId() (Turn Off button) still clears it', enrollmentAfterExplicitRemove, null);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
