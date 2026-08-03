/* ============================= ACCOUNT (mobile profile page) =============================
   Reached by tapping the avatar/name row in the mobile "More" sheet (see
   .more-sheet-account in chrome.js/styles.css) -- mirrors a reference app's
   dedicated Account screen the user shared (avatar+role header, a shop-info
   card, then preference/action rows), using ServisPro's own colors rather
   than that reference's palette. Deliberately skips that reference's
   Credit Balance / Referral Code / Subscription-tier rows -- those are the
   other app's own monetization model, which ServisPro doesn't have. */
function viewAccount(){
  const en = state.language==='en';
  const s = state.currentStaff;
  const shop = db.settings;
  const manage = canManage();
  return `
  <div class="section-head">
    <div>
      <h1>${en?'Account':'Akaun'}</h1>
      <div class="sub">${en?'Your profile and workshop info':'Profil anda dan maklumat bengkel'}</div>
    </div>
  </div>

  <div class="panel account-hero">
    <div class="user-avatar account-hero-avatar">${initials(s?s.name:'')}</div>
    <div style="min-width:0;">
      <div class="account-hero-name">${esc(s?s.name:'')}</div>
      <div class="account-hero-role">${esc(s?s.role:'')}</div>
      ${s && s.email ? `<div class="account-hero-email">${ICONS.mail}<span>${esc(s.email)}</span></div>` : ''}
    </div>
  </div>

  <div class="panel">
    <h2>${ICONS.settings} ${en?'Workshop':'Bengkel'}</h2>
    <div class="account-row ${manage?'clickable':''}" ${manage?'data-nav="settings"':''}>
      <div class="workspace-logo">${shop.shopLogo ? `<img src="${shop.shopLogo}" alt="" width="40" height="40" style="object-fit:contain;">` : logoMarkHtml(40)}</div>
      <div style="min-width:0;flex:1;">
        <div class="account-row-title">${esc(shop.shopName || (en?'ServisPro Auto Service':'ServisPro Auto Servis'))}</div>
        <div class="account-row-sub">${esc(shop.shopPhone || (en?'No phone number set':'Tiada nombor telefon'))}</div>
      </div>
      ${manage ? ICONS.chevronRight : ''}
    </div>
    ${!manage ? `<div style="font-size:11px;color:var(--text-muted);margin-top:10px;">${en?'Ask your shop Admin to update workshop details.':'Minta Admin bengkel kemas kini maklumat bengkel.'}</div>` : ''}
  </div>

  <div class="panel">
    <h2>${en?'Preferences':'Keutamaan'}</h2>
    <div class="sidebar-account-actions account-page-actions">
      <div class="sidebar-account-toggles">
        <div class="theme-toggle" data-action="toggle-theme" title="${tt('Tukar tema')}">
          <div class="t-icon ${state.theme==='light'?'active':''}">${ICONS.sun}</div>
          <div class="t-icon ${state.theme==='dark'?'active':''}">${ICONS.moon}</div>
        </div>
        <div class="theme-toggle" data-action="toggle-lang" title="Switch language">
          <div class="t-icon ${state.language==='ms'?'active':''}" style="font-size:10px;font-weight:700;">MS</div>
          <div class="t-icon ${state.language==='en'?'active':''}" style="font-size:10px;font-weight:700;">EN</div>
        </div>
      </div>
      <div class="sidebar-account-buttons">
        <button class="btn-icon" data-action="open-mfa-settings" title="2FA">${ICONS.shield}</button>
        ${faceIdSupportedSync() ? `<button class="btn-icon" data-action="open-faceid-settings" title="Face ID">${ICONS.faceid}</button>` : ''}
        <button class="btn-icon" data-action="logout" title="${t('btn_logout')}">${ICONS.logout}</button>
      </div>
    </div>
  </div>
  `;
}
