// Runs every *.test.js in this folder sequentially (they share one live
// Supabase test account, so parallel runs would race each other) and exits
// non-zero if any suite fails. Use `npm test` or `node tests/run-all.js`.
const fs = require('fs');
const path = require('path');
const syntaxCheck = require('./syntax-check.test.js');

async function main(){
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f !== 'syntax-check.test.js');

  console.log('=== syntax-check ===');
  const syntaxOk = syntaxCheck.run();
  console.log('');

  const results = [{ name: 'syntax-check', ok: syntaxOk }];

  for(const file of files){
    console.log(`=== ${file.replace('.test.js','')} ===`);
    const mod = require(path.join(dir, file));
    let ok = false;
    try{
      ok = await mod.run();
    }catch(e){
      console.log(`  FATAL: ${e.message}`);
      ok = false;
    }
    results.push({ name: file.replace('.test.js',''), ok });
    console.log('');
  }

  console.log('=== SUMMARY ===');
  results.forEach(r => console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}`));
  const allOk = results.every(r => r.ok);
  console.log(allOk ? '\nAll suites passed.' : '\nSome suites failed.');
  process.exit(allOk ? 0 : 1);
}

main();
