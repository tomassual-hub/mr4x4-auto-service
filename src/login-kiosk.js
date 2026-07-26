// @ts-nocheck
// Same reasoning as event-handlers.js: dominated by raw DOM .value reads
// off getElementById() results, plus one string|Job union tsc can't narrow
// without a discriminant. Low type-checking value relative to the noise.
function renderLoginScreen(){
  const en = state.language==='en';
  if(state.authBusy){
    return `
    <div class="login-screen">
      <div class="login-box" style="text-align:center;">
        <div class="login-brand">
          <div class="mark"><img src="${LOGO_DATA_URI}" alt="Mr 4x4 Auto Service" style="height:160px;width:auto;display:block;margin:0 auto;"></div>
          <div class="sub">${en?'Signing in…':'Sedang log masuk…'}</div>
        </div>
      </div>
    </div>`;
  }
  const logoBlock = `<div class="mark"><img src="${LOGO_DATA_URI}" alt="Mr 4x4 Auto Service" style="height:160px;width:auto;display:block;margin:0 auto;"></div>`;
  const errBlock = state.loginError ? `<div style="font-size:12px;color:var(--danger);margin-bottom:10px;">${state.loginError}</div>` : '';
  const noticeBlock = state.loginNotice ? `<div style="font-size:12px;color:var(--success);margin-bottom:10px;">${state.loginNotice}</div>` : '';
  const mode = state.authMode || 'login';

  if(mode==='mfa-challenge'){
    return `
    <div class="login-screen">
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Two-Factor Verification':'Pengesahan Dua Faktor'}</div></div>
        <div class="panel">
          <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Enter the 6-digit code from your authenticator app.':'Masukkan kod 6 digit dari aplikasi authenticator anda.'}</p>
          <div class="field"><input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:20px;letter-spacing:6px;"></div>
          ${errBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-mfa-verify">${en?'Verify':'Sahkan'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="mfa-cancel" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Back to log in':'Kembali ke log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  if(mode==='reset'){
    return `
    <div class="login-screen">
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Set a New Password':'Tetapkan Kata Laluan Baharu'}</div></div>
        <div class="panel">
          <div class="field"><label>${en?'New Password':'Kata Laluan Baharu'}</label><input id="reset-password" type="password" placeholder="••••••••" autocomplete="new-password"></div>
          ${errBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-reset-password">${en?'Save New Password':'Simpan Kata Laluan'}</button>
        </div>
      </div>
    </div>`;
  }

  if(mode==='forgot'){
    return `
    <div class="login-screen">
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Reset Password':'Reset Kata Laluan'}</div></div>
        <div class="panel">
          <div class="field"><label>${en?'Email':'E-mel'}</label><input id="forgot-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
          ${errBlock}${noticeBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-forgot-password">${en?'Send Reset Link':'Hantar Pautan Reset'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="auth-mode-login" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Back to log in':'Kembali ke log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  if(mode==='signup'){
    return `
    <div class="login-screen">
      <div class="login-box">
        <div class="login-brand">${logoBlock}<div class="sub">${en?'Create Account':'Daftar Akaun'}</div></div>
        <div class="panel">
          <p style="font-size:12px;color:var(--text-muted);margin-top:0;">${en?'Use the same email your Admin added you with in Settings → Staff.':'Guna e-mel yang sama seperti yang Admin tambah di Tetapan → Staf.'}</p>
          <div class="field"><label>${en?'Email':'E-mel'}</label><input id="signup-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
          <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="signup-password" type="password" placeholder="${en?'At least 6 characters':'Sekurang-kurangnya 6 aksara'}" autocomplete="new-password"></div>
          ${errBlock}${noticeBlock}
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-signup">${en?'Create Account':'Daftar Akaun'}</button>
        </div>
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="auth-mode-login" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'Already have an account? Log in':'Sudah ada akaun? Log masuk'}</span>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="login-screen">
    <div class="login-box">
      <div class="login-brand">
        ${logoBlock}
        <div class="sub">${t('login_title')}</div>
      </div>
      <div class="panel">
        <div class="field"><label>${en?'Email':'E-mel'}</label><input id="login-email" type="email" placeholder="nama@contoh.com" autocomplete="username"></div>
        <div class="field"><label>${en?'Password':'Kata Laluan'}</label><input id="login-password" type="password" placeholder="••••••••" autocomplete="current-password"></div>
        ${errBlock}
        <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="do-login">${en?'Log In':'Log Masuk'}</button>
        <div style="text-align:right;margin-top:8px;">
          <span class="clickable" data-action="auth-mode-forgot" style="font-size:11.5px;color:var(--text-muted);text-decoration:underline;">${en?'Forgot password?':'Lupa kata laluan?'}</span>
        </div>
      </div>
      <div style="text-align:center;margin-top:18px;display:flex;flex-direction:column;gap:8px;">
        <span class="clickable" data-action="auth-mode-signup" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${en?'New staff? Create an account':'Staf baharu? Daftar akaun'}</span>
        <span class="clickable" data-action="open-kiosk" style="font-size:12.5px;color:var(--text-muted);text-decoration:underline;">${ICONS.gauge} ${t('kiosk_link')}</span>
      </div>
    </div>
  </div>`;
}


function initials(name){
  return (name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

function setAuthMode(mode){
  state.authMode = mode;
  state.loginError = '';
  state.loginNotice = '';
  render();
}

function attachLoginHandlers(){
  const en = state.language==='en';
  const kioskLink = document.querySelector('[data-action="open-kiosk"]');
  if(kioskLink) kioskLink.addEventListener('click', ()=>{ state.kioskMode=true; state.kioskQuery=''; render(); });

  document.querySelectorAll('[data-action="auth-mode-login"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('login')));
  document.querySelectorAll('[data-action="auth-mode-signup"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('signup')));
  document.querySelectorAll('[data-action="auth-mode-forgot"]').forEach(el=>el.addEventListener('click', ()=>setAuthMode('forgot')));

  const bindEnter = (id, fn)=>{ const el = document.getElementById(id); if(el) el.addEventListener('keydown', e=>{ if(e.key==='Enter') fn(); }); };

  // ---- log in ----
  const doLogin = async ()=>{
    const email = (document.getElementById('login-email')||{}).value?.trim() || '';
    const password = (document.getElementById('login-password')||{}).value || '';
    if(!email || !password){
      state.loginError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
      render();
      return;
    }
    state.loginError = '';
    state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){
      state.authBusy = false;
      state.loginError = en ? 'Incorrect email or password.' : 'E-mel atau kata laluan salah.';
      render();
      return;
    }
    await resolveSessionOrChallengeMfa(data.session);
  };
  const loginBtn = document.querySelector('[data-action="do-login"]');
  if(loginBtn) loginBtn.addEventListener('click', doLogin);
  bindEnter('login-email', doLogin);
  bindEnter('login-password', doLogin);

  // ---- sign up (self-service; only links to a staff row an Admin already added by email) ----
  const doSignup = async ()=>{
    const email = (document.getElementById('signup-email')||{}).value?.trim() || '';
    const password = (document.getElementById('signup-password')||{}).value || '';
    if(!email || !password){
      state.loginError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
      render();
      return;
    }
    if(password.length<6){
      state.loginError = en ? 'Password must be at least 6 characters.' : 'Kata laluan mesti sekurang-kurangnya 6 aksara.';
      render();
      return;
    }
    state.loginError = ''; state.loginNotice = ''; state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if(error){
      state.authBusy = false;
      state.loginError = error.message || (en ? 'Could not create account.' : 'Gagal mencipta akaun.');
      render();
      return;
    }
    if(data.session){
      // Email confirmation is off for this project — session is active immediately.
      await handleAuthenticated(data.session);
    } else {
      // Email confirmation required — they'll click a link, then log in normally.
      state.authBusy = false;
      state.authMode = 'login';
      state.loginNotice = en ? 'Account created — check your email to confirm, then log in.' : 'Akaun dicipta — semak e-mel anda untuk sahkan, kemudian log masuk.';
      render();
    }
  };
  const signupBtn = document.querySelector('[data-action="do-signup"]');
  if(signupBtn) signupBtn.addEventListener('click', doSignup);
  bindEnter('signup-email', doSignup);
  bindEnter('signup-password', doSignup);

  // ---- forgot password ----
  const doForgotPassword = async ()=>{
    const email = (document.getElementById('forgot-email')||{}).value?.trim() || '';
    if(!email){
      state.loginError = en ? 'Enter your email.' : 'Masukkan e-mel anda.';
      render();
      return;
    }
    state.loginError = ''; state.loginNotice = ''; state.authBusy = true;
    render();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
    state.authBusy = false;
    if(error){
      state.loginError = error.message || (en ? 'Could not send reset email.' : 'Gagal menghantar e-mel reset.');
      render();
      return;
    }
    state.loginNotice = en ? 'If that email has an account, a reset link has been sent.' : 'Jika e-mel itu ada akaun, pautan reset telah dihantar.';
    render();
  };
  const forgotBtn = document.querySelector('[data-action="do-forgot-password"]');
  if(forgotBtn) forgotBtn.addEventListener('click', doForgotPassword);
  bindEnter('forgot-email', doForgotPassword);

  // ---- set new password (arrived via recovery email link) ----
  const doResetPassword = async ()=>{
    const password = (document.getElementById('reset-password')||{}).value || '';
    if(password.length<6){
      state.loginError = en ? 'Password must be at least 6 characters.' : 'Kata laluan mesti sekurang-kurangnya 6 aksara.';
      render();
      return;
    }
    state.loginError = ''; state.authBusy = true;
    render();
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if(error){
      state.authBusy = false;
      state.loginError = error.message || (en ? 'Could not update password.' : 'Gagal kemas kini kata laluan.');
      render();
      return;
    }
    state.authMode = 'login';
    const restoredSession = (await supabaseClient.auth.getSession()).data.session;
    await resolveSessionOrChallengeMfa(restoredSession || (data.user ? { user: data.user } : null));
  };
  const resetBtn = document.querySelector('[data-action="do-reset-password"]');
  if(resetBtn) resetBtn.addEventListener('click', doResetPassword);
  bindEnter('reset-password', doResetPassword);

  // ---- 2FA challenge (after password, before the app actually opens) ----
  const doMfaVerify = async ()=>{
    const code = (document.getElementById('mfa-code')||{}).value?.trim() || '';
    if(!/^\d{6}$/.test(code)){
      state.loginError = en ? 'Enter the 6-digit code.' : 'Masukkan kod 6 digit.';
      render();
      return;
    }
    if(!state.mfaChallenge){ setAuthMode('login'); return; }
    state.loginError = ''; state.authBusy = true;
    render();
    const { error } = await supabaseClient.auth.mfa.verify({ factorId: state.mfaChallenge.factorId, challengeId: state.mfaChallenge.challengeId, code });
    if(error){
      state.authBusy = false;
      state.loginError = en ? 'Incorrect or expired code. Try again.' : 'Kod salah atau tamat tempoh. Cuba lagi.';
      // A used/expired challenge can't be retried — start a fresh one against the same factor.
      const { data: fresh } = await supabaseClient.auth.mfa.challenge({ factorId: state.mfaChallenge.factorId });
      if(fresh) state.mfaChallenge = { factorId: state.mfaChallenge.factorId, challengeId: fresh.id };
      render();
      return;
    }
    state.mfaChallenge = null;
    state.authMode = 'login';
    const { data:{ session } } = await supabaseClient.auth.getSession();
    await handleAuthenticated(session);
  };
  const mfaBtn = document.querySelector('[data-action="do-mfa-verify"]');
  if(mfaBtn) mfaBtn.addEventListener('click', doMfaVerify);
  bindEnter('mfa-code', doMfaVerify);
  const mfaCancelBtn = document.querySelector('[data-action="mfa-cancel"]');
  if(mfaCancelBtn) mfaCancelBtn.addEventListener('click', async ()=>{
    state.mfaChallenge = null;
    await supabaseClient.auth.signOut();
    setAuthMode('login');
  });
}

/* ---------- CONFIRM MODAL ---------- */
/* ---------- KIOSK MODE (public status check, no login) ---------- */
function renderKioskScreen(){
  const q = (state.kioskQuery||'').trim();
  let result = null;
  if(q){
    const ql = q.toLowerCase();
    const job = db.jobs.find(j=>j.jobNo.toLowerCase()===ql) ||
      [...db.jobs].reverse().find(j=>{ const v=getVehicle(j.vehicleId); return v && v.plate.toLowerCase().replace(/\s/g,'')===ql.replace(/\s/g,''); });
    result = job || 'notfound';
  }
  const statusLabel = {waiting:'Menunggu Giliran', progress:'Sedang Dikerjakan', done:'Siap, Sedia Diambil', delivered:'Telah Dihantar'};
  const statusDesc = {
    waiting:'Kenderaan anda telah didaftarkan dan sedang menunggu giliran mekanik.',
    progress:'Mekanik kami sedang mengerjakan kenderaan anda sekarang.',
    done:'Kerja telah siap! Kenderaan anda sedia untuk diambil.',
    delivered:'Kenderaan telah dihantar/diambil. Terima kasih kerana menggunakan perkhidmatan kami.'
  };
  return `
  <div class="login-screen">
    <div class="login-box">
      <div class="login-brand">
        <div class="mark"><img src="${LOGO_DATA_URI}" alt="Mr 4x4 Auto Service" style="height:112px;width:auto;display:block;margin:0 auto;"></div>
        <div class="sub">Semak Status Kenderaan</div>
      </div>
      <div class="panel">
        <div class="field"><label>No. Kad Kerja atau No. Plat</label>
          <input id="kiosk-input" placeholder="cth: WS-0001 atau WXY 1234" value="${state.kioskQuery||''}">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="kiosk-check">${ICONS.search} Semak Status</button>
        ${result==='notfound' ? `<div class="empty" style="padding:20px 0 0;">Tiada rekod dijumpai. Sila semak semula no. kad kerja / plat.</div>` : ''}
        ${result && result!=='notfound' ? (()=>{
          const v = getVehicle(result.vehicleId);
          return `
          <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border);">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted);">${result.jobNo}</div>
            <div style="font-size:16px;font-weight:700;margin:4px 0;">${v?v.plate:'-'} ${v?'· '+v.model:''}</div>
            <span class="pill pill-${result.status==='waiting'?'wait':result.status}">${statusLabel[result.status]}</span>
            <p style="font-size:12.5px;color:var(--text-muted);margin-top:12px;">${statusDesc[result.status]}</p>
          </div>
          ${result.status==='delivered' ? renderKioskFeedback(result) : ''}`;
        })() : ''}
        <div style="text-align:center;margin-top:18px;">
          <span class="clickable" data-action="close-kiosk" style="font-size:12px;color:var(--text-muted);text-decoration:underline;">← Kembali ke Log Masuk Staf</span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderKioskFeedback(job){
  if(job.rating){
    return `<div style="margin-top:14px;padding:12px;background:rgba(79,165,121,.12);border-radius:8px;text-align:center;">
      <div style="font-size:20px;">${'⭐'.repeat(job.rating)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Terima kasih atas maklum balas anda!</div>
    </div>`;
  }
  const rating = state.kioskRatingValue||0;
  return `
  <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);">
    <label style="display:block;margin-bottom:8px;">Bagaimana perkhidmatan kami?</label>
    <div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;">
      ${[1,2,3,4,5].map(n=>`<span class="clickable" data-kiosk-star="${n}" style="font-size:26px;filter:${n<=rating?'none':'grayscale(1) opacity(0.4)'};">⭐</span>`).join('')}
    </div>
    <textarea id="kiosk-feedback-text" rows="2" placeholder="Ulasan (pilihan)"></textarea>
    <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" data-action="submit-feedback" data-id="${job.id}">Hantar Maklum Balas</button>
  </div>`;
}

function attachKioskHandlers(){
  bindAction('close-kiosk', ()=>{ state.kioskMode=false; state.kioskQuery=''; state.kioskRatingValue=0; render(); });
  bindAction('kiosk-check', ()=>{
    state.kioskQuery = document.getElementById('kiosk-input').value;
    render();
  });
  const kInput = document.getElementById('kiosk-input');
  if(kInput) kInput.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ state.kioskQuery = kInput.value; render(); }
  });
  document.querySelectorAll('[data-kiosk-star]').forEach(el=>el.addEventListener('click', ()=>{
    state.kioskRatingValue = Number(el.dataset.kioskStar);
    render();
  }));
  bindAllAction('submit-feedback', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    if(!job || !state.kioskRatingValue) return;
    job.rating = state.kioskRatingValue;
    job.feedback = document.getElementById('kiosk-feedback-text').value.trim();
    queueSave();
    state.kioskRatingValue = 0;
    render();
  });
}

/* ---------- ONBOARDING TOUR (first-time users) ---------- */
