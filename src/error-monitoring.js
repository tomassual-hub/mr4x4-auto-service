/* ============================= ERROR MONITORING ============================= */
// Sentry (sentry.io). Leave SENTRY_DSN empty to disable entirely — the SDK
// is never even fetched over the network in that case (not just inert), so
// there's zero footprint until this is configured. See
// backend/SENTRY_SETUP.md for how to get a DSN and turn this on.
const SENTRY_DSN = 'https://1b190d996f6c573fc2af2fd566570042@o4511794353733632.ingest.de.sentry.io/4511794375557200';
let sentryReady = false;

function initErrorMonitoring(){
  if(!SENTRY_DSN) return;
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/8.42.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  // Pinned to an exact version (see the src above), so unlike a floating
  // tag this hash won't go stale out from under itself -- bumping the
  // version needs a freshly computed hash for the new file's exact bytes,
  // same reasoning as the Supabase CDN tag in build/_shell-pieces.json.
  script.integrity = 'sha384-mnCU8xfJtutEToQVAp8cVl1c5MsLJHnf0uLTs2w7gf115tH/bz7Nwd+LgjiBgW5P';
  script.onload = () => {
    if(typeof Sentry === 'undefined') return;
    Sentry.init({
      dsn: SENTRY_DSN,
      // file:// (local double-click) and localhost are dev/test contexts —
      // tag them so real shop errors aren't mixed in with a developer's
      // local testing in the Sentry dashboard.
      environment: (location.protocol === 'file:' || location.hostname === 'localhost') ? 'development' : 'production',
      tracesSampleRate: 0, // error capture only — performance tracing is unneeded cost/complexity for a small-shop tool
    });
    sentryReady = true;
  };
  script.onerror = () => { /* offline or CDN blocked — error monitoring just won't be there this session */ };
  document.head.appendChild(script);
}

// Sentry.init() auto-instruments window.onerror/unhandledrejection on its
// own — this helper is for errors the app already catches internally
// (sync failures, session-restore failures) that would otherwise only ever
// reach the browser console, invisible the moment nobody's DevTools is open.
function reportError(error, context){
  console.error(context, error);
  if(sentryReady){
    Sentry.captureException(error, { extra: { context } });
  }
}

// Called once a staff member is known, so errors in Sentry can be traced
// back to which account/role hit them — useful for triage (e.g. "only
// Mekanik accounts are hitting this") without logging anything beyond
// what's already visible in this shop's own audit log.
function identifyStaffForErrorMonitoring(staffMember){
  if(!sentryReady || !staffMember) return;
  Sentry.setUser({ id: staffMember.id, username: staffMember.name, role: staffMember.role });
}
