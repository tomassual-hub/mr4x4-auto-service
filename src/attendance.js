/* ============================= QR ATTENDANCE (punch screen) ============================= */
// Reached by scanning a staff member's personal QR code, which links to
// ?attendance=<staffId>&token=<attendanceToken> -- no login required (see
// initApp() in sync-engine.js for the URL detection, and
// attendance_status()/attendance_punch() in backend/schema.sql for the two
// narrow anonymous-safe RPCs this screen calls). The per-staff token is
// what stops someone else from punching in as a coworker just by knowing
// the app's URL -- they'd need that specific staff member's own QR code.
function renderAttendancePunch(){
  const en = state.language==='en';
  const status = state.attendanceStatus;
  let body = '';
  if(status==='loading'){
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Checking your QR code…':'Menyemak kod QR anda…'}</p>`;
  } else if(status==='invalid'){
    body = `<div class="empty">${ICONS.alert}<div>${en?'This QR code is invalid or has been reset. Ask your Admin for a fresh one.':'Kod QR ini tidak sah atau telah ditetapkan semula. Minta Admin anda untuk kod baharu.'}</div></div>`;
  } else if(status && status.punched){
    const timeStr = new Date(status.ts).toLocaleTimeString(en?'en-GB':'ms-MY',{hour:'2-digit',minute:'2-digit'});
    body = `
      <div style="text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(79,165,121,.15);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${ICONS.done}</div>
        <h2 style="margin:0 0 6px;">${status.type==='in' ? (en?'Clocked In':'Berjaya Clock In') : (en?'Clocked Out':'Berjaya Clock Out')}</h2>
        <p style="color:var(--text-muted);">${esc(status.name)} &middot; ${timeStr}</p>
      </div>`;
  } else if(status && status.name){
    const isIn = status.nextType==='in';
    body = `
      <div style="text-align:center;">
        <div class="staff-avatar" style="width:64px;height:64px;font-size:22px;margin:0 auto 14px;">${initials(status.name)}</div>
        <h2 style="margin:0 0 20px;">${en?'Hi':'Salam'}, ${esc(status.name)}!</h2>
        <button class="btn ${isIn?'btn-primary':'btn-danger'}" style="width:100%;justify-content:center;padding:18px;font-size:16px;" data-action="do-attendance-punch">
          ${isIn ? ICONS.done : ICONS.logout} ${isIn ? (en?'Clock In':'Clock In') : (en?'Clock Out':'Clock Out')}
        </button>
      </div>`;
  } else {
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Loading…':'Memuatkan…'}</p>`;
  }
  return `
  <div class="login-screen">
    <div class="login-box">
      <div class="login-brand">
        <div class="mark">${logoMarkHtml(112)}</div>
        <div class="sub">${en?'Staff Attendance':'Kehadiran Staf'}</div>
      </div>
      <div class="panel">${body}</div>
    </div>
  </div>`;
}

async function loadAttendanceStatus(){
  try{
    const { data, error } = await supabaseClient.rpc('attendance_status', { p_staff_id: state.attendanceStaffId, p_token: state.attendanceToken });
    if(error) throw error;
    state.attendanceStatus = data || 'invalid';
  }catch(e){
    reportError(e, 'Semak status kehadiran gagal');
    state.attendanceStatus = 'invalid';
  }
  render();
}

function attachAttendancePunchHandlers(){
  if(state.attendanceStatus==='loading' && !state.attendanceStatusLoading){
    state.attendanceStatusLoading = true;
    loadAttendanceStatus();
  }
  bindAction('do-attendance-punch', async ()=>{
    const en = state.language==='en';
    try{
      const { data, error } = await supabaseClient.rpc('attendance_punch', { p_staff_id: state.attendanceStaffId, p_token: state.attendanceToken });
      if(error) throw error;
      if(!data){ state.attendanceStatus = 'invalid'; render(); return; }
      state.attendanceStatus = { ...data, punched:true };
      render();
    }catch(e){
      reportError(e, 'Rekod kehadiran gagal');
      showToast(en?'Could not record attendance. Check your connection and try again.':'Gagal rekod kehadiran. Semak sambungan anda dan cuba lagi.');
    }
  });
}
