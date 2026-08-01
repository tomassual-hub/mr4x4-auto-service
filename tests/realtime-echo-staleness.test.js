// Regression guard for handleRemoteChange()'s field-level merge. Two
// attempts at this preceded the current one (see the comment above the
// merge logic in src/sync-engine.js for the full history):
//   1. No staleness check at all -- a delayed echo of an older write could
//      silently overwrite a newer, not-yet-synced local edit to the same
//      field (e.g. an inventory qty).
//   2. A whole-record staleness check -- fixed #1, but broke a DIFFERENT
//      real case: a record touched by two unrelated actors close together
//      (e.g. a customer's kiosk-submitted signature landing while staff
//      has an unsynced edit to a different field on the same job) got the
//      unrelated field's echo silently dropped too, because a whole-record
//      diff can't tell "stale echo of our own old write" apart from
//      "legitimate concurrent edit to an unrelated field."
// The current version merges field by field: only the specific field(s)
// with a pending local edit get held back; everything else always accepts
// the incoming value. This test exercises all of it directly against
// handleRemoteChange() rather than trying to orchestrate real two-device
// timing, which is what caught attempt #2's regression in the first place.
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('realtime-echo-staleness');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const results = await page.evaluate(() => {
    const out = {};

    // Scenario 1 (the original bug): a stale echo carrying the OLD value
    // for a field we have a pending, not-yet-synced local edit on must be
    // rejected -- the local edit wins until our own save actually lands.
    {
      const jobId = uid();
      const original = { id: jobId, status: 'waiting', note: 'v1' };
      db.jobs.push(original);
      lastSynced.jobs.set(jobId, JSON.stringify(original));
      db.jobs.find(j=>j.id===jobId).note = 'v2-local-not-synced';
      handleRemoteChange('jobs', { eventType:'UPDATE', new: { id: jobId, data: { id: jobId, status: 'waiting', note: 'v1' } } });
      out.staleFieldHeldBack = db.jobs.find(j=>j.id===jobId).note;
      db.jobs = db.jobs.filter(j=>j.id!==jobId);
      lastSynced.jobs.delete(jobId);
    }

    // Scenario 2 (the regression case): an echo touching a DIFFERENT field
    // (no pending local edit on that specific field) must still apply,
    // even though the record has an unrelated pending local edit.
    {
      const jobId = uid();
      const original = { id: jobId, status: 'waiting', note: 'v1', signed: false };
      db.jobs.push(original);
      lastSynced.jobs.set(jobId, JSON.stringify(original));
      db.jobs.find(j=>j.id===jobId).note = 'checklist-edit-local-not-synced';
      handleRemoteChange('jobs', { eventType:'UPDATE', new: { id: jobId, data: { id: jobId, status: 'waiting', note: 'v1', signed: true } } });
      const after = db.jobs.find(j=>j.id===jobId);
      out.unrelatedPendingFieldPreserved = after.note;
      out.unrelatedNewFieldAccepted = after.signed;
      db.jobs = db.jobs.filter(j=>j.id!==jobId);
      lastSynced.jobs.delete(jobId);
    }

    // Scenario 3 (baseline): no pending edits at all -- echo applies
    // normally, same as before any of this staleness logic existed.
    {
      const jobId = uid();
      const original = { id: jobId, status: 'waiting', note: 'v1' };
      db.jobs.push(original);
      lastSynced.jobs.set(jobId, JSON.stringify(original));
      handleRemoteChange('jobs', { eventType:'UPDATE', new: { id: jobId, data: { id: jobId, status: 'done', note: 'v1' } } });
      out.cleanEchoApplies = db.jobs.find(j=>j.id===jobId).status;
      db.jobs = db.jobs.filter(j=>j.id!==jobId);
      lastSynced.jobs.delete(jobId);
    }

    // Scenario 4: a held-back field must NOT be marked as synced in
    // lastSynced -- otherwise the next save cycle would think there's
    // nothing left to push and the pending edit would never reach Supabase.
    {
      const jobId = uid();
      const original = { id: jobId, status: 'waiting', note: 'v1' };
      db.jobs.push(original);
      lastSynced.jobs.set(jobId, JSON.stringify(original));
      db.jobs.find(j=>j.id===jobId).note = 'pending-local-edit';
      handleRemoteChange('jobs', { eventType:'UPDATE', new: { id: jobId, data: { id: jobId, status: 'waiting', note: 'stale' } } });
      out.heldBackFieldStaysUnsynced = JSON.parse(lastSynced.jobs.get(jobId)).note;
      db.jobs = db.jobs.filter(j=>j.id!==jobId);
      lastSynced.jobs.delete(jobId);
    }

    // Scenario 5: a record with no prior lastSynced entry at all (never
    // locally created/edited on this device) -- echo applies in full,
    // same as a totally fresh remote record always has.
    {
      const jobId = uid();
      handleRemoteChange('jobs', { eventType:'UPDATE', new: { id: jobId, data: { id: jobId, status: 'waiting', note: 'brand-new-from-elsewhere' } } });
      const rec = db.jobs.find(j=>j.id===jobId);
      out.freshRemoteRecordApplies = rec ? rec.note : null;
      if(rec) db.jobs = db.jobs.filter(j=>j.id!==jobId);
    }

    return out;
  });

  r.check('stale echo held back on a field with a pending local edit', results.staleFieldHeldBack, 'v2-local-not-synced');
  r.check('unrelated pending field preserved when a different field\'s echo arrives', results.unrelatedPendingFieldPreserved, 'checklist-edit-local-not-synced');
  r.check('new field from a legitimate concurrent echo is accepted', results.unrelatedNewFieldAccepted, true);
  r.check('echo with no local conflict applies normally', results.cleanEchoApplies, 'done');
  r.check('held-back field is not marked synced (still pushed next cycle)', results.heldBackFieldStaysUnsynced, 'v1');
  r.check('a totally fresh remote record applies in full', results.freshRemoteRecordApplies, 'brand-new-from-elsewhere');

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
