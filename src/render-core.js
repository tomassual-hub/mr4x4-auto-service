/* ============================= RENDER ROUTER ============================= */
// Modal focus management: without this, Tab cycles through the sidebar/page
// content sitting visually behind an open modal (it's a DOM sibling of
// .app, not layered any other way), focus doesn't move into the modal when
// it opens, and closing one leaves focus reset to <body> instead of back on
// whatever button opened it. All three matter for keyboard/screen-reader
// use, which this app's near-total reliance on click-driven modals
// otherwise blocks. renderModal()/renderConfirmModal()/renderOnboarding()
// all share the same .modal-overlay > .modal structure, so one mechanism
// covers every modal type.
// A DOM node reference (not a selector) can't survive across a render --
// render() replaces root.innerHTML wholesale on every call, including the
// very call that opens a modal (it rebuilds the page underneath the modal
// too), which discards and recreates every node, trigger button included.
// So "remember what to refocus" has to be a re-queryable selector built
// from the trigger element's own data-* attribute, not the element itself.
let modalReturnFocusSelector = null;
let modalWasOpen = false;
// document.activeElement can't be trusted at the moment a modal-opening
// render() runs, either: runGuardedAction() (main.js) disables the clicked
// button SYNCHRONOUSLY before calling its handler (the double-click guard),
// and a disabled element loses focus immediately -- by the time render()
// reads document.activeElement, it's already <body>. Track the last
// element the user actually interacted with outside any open modal
// instead, via mousedown (fires before click, so before that disabling)
// and focusin (covers keyboard Tab+Enter activation, which never disables
// anything before firing).
let lastNonModalFocusEl = null;
document.addEventListener('mousedown', (e)=>{
  const t = /** @type {HTMLElement} */ (e.target);
  if(t && t.closest && !t.closest('.modal-overlay')){
    lastNonModalFocusEl = /** @type {HTMLElement} */ (t.closest('button,[data-action],[data-nav],[tabindex]') || t);
  }
}, true);
document.addEventListener('focusin', (e)=>{
  const t = /** @type {HTMLElement} */ (e.target);
  if(t && t.closest && !t.closest('.modal-overlay')) lastNonModalFocusEl = t;
});
function isModalBlocking(){
  return !!(state.modal || state.confirmAction || state.showOnboarding);
}
function getFocusableInModal(){
  const modalEl = document.querySelector('.modal-overlay .modal');
  if(!modalEl) return [];
  return Array.from(modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]'))
    .filter(el=>!el.hasAttribute('disabled') && el.getAttribute('tabindex')!=='-1' && /** @type {HTMLElement} */(el).offsetParent!==null);
}
function selectorForFocusReturn(el){
  if(!el || !el.tagName || el===document.body) return null;
  for(const attr of INTERACTIVE_DATA_ATTRS){
    if(el.hasAttribute(attr)){
      let sel = `[${attr}="${CSS.escape(el.getAttribute(attr)||'')}"]`;
      if(el.hasAttribute('data-id')) sel += `[data-id="${CSS.escape(el.getAttribute('data-id')||'')}"]`;
      return sel;
    }
  }
  return el.id ? '#'+CSS.escape(el.id) : null;
}
function closeActiveModalViaEscape(){
  if(state.confirmAction){ setState({confirmAction:null}); return; }
  if(state.showOnboarding){
    const skipBtn = /** @type {HTMLElement} */ (document.querySelector('[data-action="onboarding-skip"]'));
    if(skipBtn) skipBtn.click();
    return;
  }
  if(state.modal){ setState({modal:null}); }
}
function manageModalFocus(){
  const isOpen = isModalBlocking();
  if(isOpen && !modalWasOpen){
    modalReturnFocusSelector = selectorForFocusReturn(lastNonModalFocusEl);
    const modalEl = /** @type {HTMLElement|null} */ (document.querySelector('.modal-overlay .modal'));
    if(modalEl){
      if(!modalEl.hasAttribute('tabindex')) modalEl.setAttribute('tabindex','-1');
      modalEl.focus();
    }
  } else if(!isOpen && modalWasOpen){
    const returnEl = /** @type {HTMLElement|null} */ (modalReturnFocusSelector ? document.querySelector(modalReturnFocusSelector) : null);
    if(returnEl) returnEl.focus();
    modalReturnFocusSelector = null;
  }
  modalWasOpen = isOpen;
}

function render(){
  document.documentElement.setAttribute('data-theme', state.theme);
  resetInactivityTimer();
  const root = document.getElementById('root');
  if(state.attendanceMode){
    root.innerHTML = renderAttendancePunch();
    makeClickablesFocusable();
    attachAttendancePunchHandlers();
    return;
  }
  if(state.inspectMode){
    root.innerHTML = renderInspectionReport();
    makeClickablesFocusable();
    attachInspectionReportHandlers();
    return;
  }
  if(state.boardMode){
    root.innerHTML = renderDisplayBoard();
    makeClickablesFocusable();
    attachDisplayBoardHandlers();
    return;
  }
  if(state.kioskMode){
    root.innerHTML = renderKioskScreen();
    makeClickablesFocusable();
    attachKioskHandlers();
    return;
  }
  if(!state.currentStaff){
    root.innerHTML = renderLoginScreen();
    makeClickablesFocusable();
    attachLoginHandlers();
    return;
  }
  // Dashboard's hero banner carries its own notif bell + brand title on
  // mobile (see viewDashboard()/dash-hero-brand) -- only when it actually
  // renders (isAdmin, same gate as the hero panel itself), so the topbar's
  // own copies must stay visible for non-Admin roles, who never get a hero
  // to replace them. Must match viewDashboard()'s own isAdmin check exactly.
  const heroReplacesTopbar = state.view==='dashboard' && state.currentStaff && state.currentStaff.role==='Admin';
  root.innerHTML = `
    <div class="app">
      ${renderSidebar()}
      <div class="sidebar-backdrop ${state.navOpen?'show':''}" data-action="close-nav"></div>
      <div class="main" data-hero-notif="${heroReplacesTopbar?1:0}">
        ${renderTopbar()}
        ${renderSyncErrorBanner()}
        <div class="content">${renderView()}</div>
      </div>
      ${renderMobileTabBar()}
      ${renderMobileMoreSheet()}
      ${renderMobileHelpBubble()}
    </div>
    ${state.modal ? renderModal() : ''}
    ${state.confirmAction ? renderConfirmModal() : ''}
    ${state.showOnboarding ? renderOnboarding() : ''}
  `;
  makeClickablesFocusable();
  attachHandlers();
  manageModalFocus();
}

/* ---------- LOGIN ---------- */
