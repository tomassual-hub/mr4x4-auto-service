/* ============================= APP STATE ============================= */
let state = {
  view: 'dashboard',
  language: 'ms',
  modal: null,       // {type, payload}
  posCart: [],
  posCustomerId: '',
  posVehicleId: '',
  posJobId: '',
  invTab: 'semua',
  jobFilter: 'semua',
  reportRange: 30,
  currentStaff: null,   // session only, not persisted
  authBusy: false,
  authMode: 'login',    // 'login' | 'signup' | 'forgot' | 'reset'
  loginError: '',
  loginNotice: '',
  syncStatus: 'idle',   // 'idle' | 'syncing' | 'error'
  offlineMode: false,
  offlineCacheAt: null,
  confirmAction: null,  // {message, onConfirm}
  customerSearch: '',
  theme: 'dark',
  navOpen: false,
  posDiscountType: 'flat',
  posDiscountValue: 0,
  globalSearch: '',
  apptTab: 'appointments',
  kioskMode: false,
  kioskQuery: '',
  // null = no search yet, 'loading' = RPC in flight, 'notfound' = searched
  // with no match, or the {id,jobNo,status,plate,model,rating,feedback}
  // object from kiosk_lookup_job() -- see attachKioskHandlers().
  kioskResult: /** @type {'loading'|'notfound'|{id:string,jobNo:string,status:string,plate:string,model:string,rating:number|null,feedback:string}|null} */ (null),
  currentBranch: 'all',
  notifOpen: false,
  lastDeleted: null,
  staffTab: 'staff',
  invMainTab: 'items',
  kioskRatingValue: 0,
  simpleMode: false,
  showOnboarding: false,
  onboardingStep: 0,
  jobsShowCount: 30,
  customersShowCount: 30,
  autoBackupsList: /** @type {{id:string, created_at:string}[]|null} */ (null),
  mfaFactors: /** @type {{id:string, status:string}[]|null} */ (null),
  mfaEnrollment: /** @type {{factorId:string, qrSvg:string, secret:string}|null} */ (null),
  mfaChallenge: /** @type {{factorId:string, challengeId:string}|null} */ (null),
  payrollMonth: /** @type {string|null} */ (null),
};

function setState(patch){ Object.assign(state, patch); render(); }
function showToast(msg, undoFn){
  // Patches its own dedicated #toast-root node directly instead of going
  // through render() — render() replaces #root's entire innerHTML in one
  // shot (view + modal + confirm dialog together), so routing a toast
  // through it would rebuild whatever modal is currently open from scratch,
  // silently discarding any not-yet-saved input the user had typed into it.
  const container = document.getElementById('toast-root');
  if(!container) return;
  // showToast._t: a debounce-timer handle stashed on the function itself
  // (a common vanilla-JS idiom) rather than a module-level variable — no
  // ES module boundary here to hold one privately. `any` cast is just to
  // satisfy tsc about the extra property; behavior is unaffected.
  clearTimeout(/** @type {any} */ (showToast)._t);
  container.innerHTML = `<div class="toast">${msg}${undoFn ? ` <span class="clickable" data-action="undo-delete" style="text-decoration:underline;font-weight:700;margin-left:6px;">Buat Asal</span>` : ''}</div>`;
  if(undoFn){
    const undoEl = container.querySelector('[data-action="undo-delete"]');
    if(undoEl) undoEl.addEventListener('click', ()=>{ undoFn(); container.innerHTML = ''; clearTimeout(/** @type {any} */ (showToast)._t); });
  }
  /** @type {any} */ (showToast)._t = setTimeout(()=>{ container.innerHTML = ''; }, undoFn ? 5000 : 2200);
}

function showUpdateAvailableToast(){
  // Deliberately does NOT auto-dismiss like showToast() — a new service
  // worker has already taken over in the background (see the
  // controllerchange listener in the app shell), but the currently loaded
  // page is still running the OLD code until reloaded. Losing this prompt
  // before the user notices would mean the fix they're waiting on stays
  // invisible until they happen to reload for some unrelated reason.
  const container = document.getElementById('toast-root');
  if(!container) return;
  const en = state.language==='en';
  container.innerHTML = `<div class="toast">${en?'A new version is ready.':'Versi baharu tersedia.'} <span class="clickable" data-action="reload-app" style="text-decoration:underline;font-weight:700;margin-left:6px;">${en?'Reload':'Muat Semula'}</span></div>`;
  const btn = container.querySelector('[data-action="reload-app"]');
  if(btn) btn.addEventListener('click', ()=>location.reload());
}

