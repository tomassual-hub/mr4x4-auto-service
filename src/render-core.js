/* ============================= RENDER ROUTER ============================= */
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
