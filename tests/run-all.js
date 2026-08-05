// Runs every *.test.js in this folder sequentially (they share one live
// Supabase test account, so parallel runs would race each other) and exits
// non-zero if any suite fails. Use `npm test` or `node tests/run-all.js`.
const fs = require('fs');
const path = require('path');
const syntaxCheck = require('./syntax-check.test.js');
const { acquireTestLock, releaseTestLock } = require('./lock.js');

async function runFile(dir, file){
  try{
    // Clear the require cache so a retry re-runs the file fresh instead of
    // reusing a module object whose top-level state (if any) already ran.
    delete require.cache[require.resolve(path.join(dir, file))];
    const mod = require(path.join(dir, file));
    return await mod.run();
  }catch(e){
    console.log(`  FATAL: ${e.message}`);
    return false;
  }
}

async function main(){
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f !== 'syntax-check.test.js');

  console.log('=== syntax-check ===');
  const syntaxOk = syntaxCheck.run();
  console.log('');

  const results = [{ name: 'syntax-check', ok: syntaxOk }];

  const gotLock = await acquireTestLock();
  try{
    for(const file of files){
      console.log(`=== ${file.replace('.test.js','')} ===`);
      let ok = await runFile(dir, file);
      if(!ok){
        // One retry of just this file, not the whole suite -- a single
        // flaky file (timing/eventual-consistency against the shared
        // backend, e.g. the known inventory-po-backup flake) shouldn't cost
        // re-running every OTHER already-passing file too, which only adds
        // more load to the same shared backend and makes flakiness more
        // likely, not less.
        console.log(`  (retrying ${file} once...)`);
        ok = await runFile(dir, file);
      }
      results.push({ name: file.replace('.test.js',''), ok });
      console.log('');
    }
  } finally {
    if(gotLock) await releaseTestLock();
  }

  console.log('=== SUMMARY ===');
  results.forEach(r => console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}`));
  const allOk = results.every(r => r.ok);
  console.log(allOk ? '\nAll suites passed.' : '\nSome suites failed.');
  process.exit(allOk ? 0 : 1);
}

main();
