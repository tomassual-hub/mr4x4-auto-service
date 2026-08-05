// Distributed lock across the shared Supabase TEST project (see
// tests/lock-schema.sql) -- makes local `npm test` runs and CI's own runs
// coordinate through the SAME mutex, not just CI-against-itself (the
// `concurrency` group in ci.yml only protects CI runs from each other).
// Plain fetch() against PostgREST's RPC endpoint rather than pulling in
// @supabase/supabase-js as a new dependency just for two calls -- Node 20
// (what CI and this repo target) has fetch() built in.
const SUPABASE_URL = 'https://vnmlwxiwifzwjgbbhooy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UY9WLveLkt_7e1JYoGV-og_h802Mlzp';

// Unique per invocation so two runners racing don't "release" each other's
// lock (release_test_lock only clears the row if holder still matches).
const HOLDER_ID = `${process.env.GITHUB_RUN_ID || 'local'}-${process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown'}-${process.pid}-${Date.now()}`;

async function rpc(name, body){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if(!res.ok) throw new Error(`${name} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Polls until the lock is free rather than failing immediately -- two runs
// landing close together should queue, same as CI's own concurrency group
// already does for CI-vs-CI. Returns false (never throws) if the lock
// schema hasn't been applied yet (tests/lock-schema.sql not run yet) or the
// test project is briefly unreachable -- degrades to "no lock" rather than
// blocking every test run until that migration lands.
async function acquireTestLock({ maxWaitMs = 8*60*1000, pollMs = 5000 } = {}){
  const deadline = Date.now() + maxWaitMs;
  for(;;){
    let got;
    try{
      got = await rpc('acquire_test_lock', { p_holder: HOLDER_ID });
    }catch(e){
      console.log(`  (skipping shared-backend lock: ${e.message})`);
      return false;
    }
    if(got === true) return true;
    if(Date.now() > deadline){
      console.log('  (timed out waiting for the shared test backend lock -- proceeding anyway)');
      return false;
    }
    console.log('  (shared test backend busy, waiting...)');
    await new Promise(r => setTimeout(r, pollMs));
  }
}

async function releaseTestLock(){
  // Best-effort -- a failed release just waits out the 20-minute stale
  // timeout in lock-schema.sql instead of wedging future runs forever.
  await rpc('release_test_lock', { p_holder: HOLDER_ID }).catch(()=>{});
}

module.exports = { acquireTestLock, releaseTestLock };
