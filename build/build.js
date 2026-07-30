// Reassembles src/*.js + src/styles.css into the single-file
// Mr 4x4 Auto Service-pwa/Mr 4x4 Auto Service.html that Netlify actually
// serves. The app runs as one big global script (no ES module boundaries
// between these files) — this build step is about organizing the source
// for editing/type-checking, not changing runtime behavior. Order between
// files barely matters (function declarations are hoisted and don't touch
// `state`/`db` until called), with one exception: main.js must be last,
// since its final line calls initApp().
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
// Overridable so `npm run build:test` can point a build at a throwaway
// Supabase project + a separate output folder, without touching the real
// production build at all. Defaults reproduce the exact previous behavior.
const OUT_DIR = path.join(ROOT, process.env.BUILD_OUT_DIR || 'Mr 4x4 Auto Service-pwa');
const OUT_HTML = path.join(OUT_DIR, 'Mr 4x4 Auto Service.html');
const OUT_SW = path.join(OUT_DIR, 'service-worker.js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://knvevgtoigcteqdinyvk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudmV2Z3RvaWdjdGVxZGlueXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDI1NzUsImV4cCI6MjEwMDQxODU3NX0.iT4voDPce2Ut3PpcOx9jz6jjCCEZ8Ozthu3vVTeykdU';

const FILE_ORDER = [
  'error-monitoring.js', // first: sync-engine.js and others call reportError()/identifyStaffForErrorMonitoring()
  'logo-data.js',
  'face-id.js', // before sync-engine.js: initApp()/handleAuthenticated() call its functions
  'sync-engine.js',
  'utils.js',
  'state.js',
  'icons.js',
  'i18n.js',
  'render-core.js',
  'login-kiosk.js',
  'attendance.js',
  'inspection-report.js',
  'display-board.js',
  'onboarding-confirm.js',
  'chrome.js',
  'views/staff.js',
  'views/appointments.js',
  'views/settings.js',
  'views/dashboard.js',
  'views/jobs.js',
  'views/inventory.js',
  'views/customers.js',
  'views/techref.js',
  'views/pos.js',
  'views/reports.js',
  'views/payroll.js',
  'print.js',
  'modal-router.js',
  'event-handlers.js',
  'main.js', // must stay last: calls initApp()
];

function build(){
  const shell = JSON.parse(fs.readFileSync(path.join(__dirname, '_shell-pieces.json'), 'utf8'));
  shell.supabaseCdnTag = shell.supabaseCdnTag
    .replace('__SUPABASE_URL__', SUPABASE_URL)
    .replace('__SUPABASE_ANON_KEY__', SUPABASE_ANON_KEY);
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jsParts = FILE_ORDER.map(name => {
    const filePath = path.join(SRC, name);
    if(!fs.existsSync(filePath)) throw new Error(`Missing source file: ${name}`);
    return `/* ---- src/${name} ---- */\n` + fs.readFileSync(filePath, 'utf8');
  });

  const html = [
    shell.headTop,
    '<style>',
    css,
    '</style>',
    shell.bodyShell,
    shell.bootstrapScript,
    shell.supabaseCdnTag,
    '<script>',
    jsParts.join('\n'),
    '</script>',
    shell.tail,
  ].join('\n');

  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`Built ${OUT_HTML} (${html.split('\n').length} lines)`);

  // service-worker.js is cache-first for the app shell (see its own comments),
  // so a returning user's browser only ever fetches a fresh copy of the app
  // when this file's own bytes change. Stamping a new build id into it on
  // every build guarantees that — otherwise a fix can ship here and stay
  // invisible indefinitely to anyone who already has the app cached/installed.
  const buildId = Date.now().toString(36);
  const swSrc = fs.readFileSync(path.join(SRC, 'service-worker.js'), 'utf8');
  // Global replace: the source file's own explanatory comment also mentions
  // __BUILD_ID__ literally, and a plain (non-global) .replace() would only
  // hit that first occurrence in the comment, leaving the real CACHE_NAME
  // constant below it still holding the literal placeholder.
  fs.writeFileSync(OUT_SW, swSrc.replace(/__BUILD_ID__/g, buildId), 'utf8');
  console.log(`Built ${OUT_SW} (cache ${buildId})`);
}

if(require.main === module){
  build();
}
module.exports = { build, FILE_ORDER };
