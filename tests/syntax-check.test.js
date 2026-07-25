// Fast sanity check with no browser: every inline <script> block in the
// built HTML must at least parse as valid JS. Catches typos/broken edits
// before wasting time on a full browser test run.
const fs = require('fs');
const path = require('path');

function run(){
  const filePath = path.join(__dirname, '..', 'Mr 4x4 Auto Service-pwa', 'Mr 4x4 Auto Service.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  console.log(`syntax-check: found ${blocks.length} <script> blocks`);
  let ok = true;
  blocks.forEach((m, i) => {
    const src = m[1];
    if(src.includes('supabase-js') || src.trim()==='') return; // external CDN script tag, or empty
    try{
      new Function(src);
    }catch(e){
      ok = false;
      console.log(`  [FAIL] block ${i}: ${e.message}`);
    }
  });
  console.log(ok ? 'syntax-check: PASS' : 'syntax-check: FAIL');
  return ok;
}

if(require.main === module){
  process.exit(run() ? 0 : 1);
}
module.exports = { run };
