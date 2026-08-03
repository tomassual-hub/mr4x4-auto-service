// Reads .env (gitignored, holds NETLIFY_AUTH_TOKEN) so `npm run deploy` never
// needs the token typed/pasted in again, then builds and pushes to Netlify.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const env = { ...process.env };
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^=#\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}

if (!env.NETLIFY_AUTH_TOKEN) {
  console.error('NETLIFY_AUTH_TOKEN not found in .env — add it there first.');
  process.exit(1);
}

execFileSync('node', ['build/build.js'], { stdio: 'inherit', cwd: root, env });
// shell:true joins argv with plain spaces before handing it to cmd.exe, so the
// space-containing dir must carry its own quotes rather than relying on argv
// separation — otherwise cmd.exe sees "Mr", "4x4", ... as separate arguments.
execFileSync('npx', ['netlify', 'deploy', '--prod', '--dir="servispro-pwa"'], { stdio: 'inherit', cwd: root, env, shell: true });
