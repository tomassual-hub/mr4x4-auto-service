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

