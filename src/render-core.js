/* ============================= RENDER ROUTER ============================= */
function render(){
  document.documentElement.setAttribute('data-theme', state.theme);
  resetInactivityTimer();
  const root = document.getElementById('root');
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
  root.innerHTML = `
    <div class="app">
      ${renderSidebar()}
      <div class="sidebar-backdrop ${state.navOpen?'show':''}" data-action="close-nav"></div>
      <div class="main">
        ${renderTopbar()}
        <div class="content">${renderView()}</div>
      </div>
    </div>
    ${state.modal ? renderModal() : ''}
    ${state.confirmAction ? renderConfirmModal() : ''}
    ${state.showOnboarding ? renderOnboarding() : ''}
  `;
  makeClickablesFocusable();
  attachHandlers();
}

/* ---------- LOGIN ---------- */
