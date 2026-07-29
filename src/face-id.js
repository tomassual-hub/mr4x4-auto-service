/* ============================= FACE ID / BIOMETRIC QUICK UNLOCK (mobile only) =============================
   Uses the device's WebAuthn platform authenticator (Face ID on iOS,
   fingerprint/face unlock on Android) purely as a LOCAL re-entry gate for
   a session Supabase already persists in this browser — it is NOT a new
   server-verified auth factor, and no credential/assertion is ever sent
   anywhere. The real security boundary stays the Supabase session itself
   (and 2FA, if the staff member has it enrolled); this feature only stops
   someone who picks up an already-logged-in phone from opening the app
   straight into the shop's data with zero additional check, the way it
   would today with no gate at all on session restore.

   Desktop is deliberately excluded (per explicit request) even where a
   platform authenticator exists (e.g. Windows Hello) — isMobileDevice()
   gates on the device itself, not just on WebAuthn capability. */

const FACE_ID_KEY = 'bk_faceid_v1';
const FACE_ID_DISMISS_KEY = 'bk_faceid_dismissed';

// The Supabase session this device already had cached, waiting on a
// biometric unlock before login-kiosk.js's faceid-lock screen proceeds to
// resolveSessionOrChallengeMfa(). Deliberately NOT part of `state` (which
// stays plain-object/serializable-ish elsewhere) — same reasoning as
// keeping the live session out of state.mfaChallenge (id only, not tokens).
let pendingFaceIdSession = null;

function isMobileDevice(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

let _faceIdSupportedPromise = null;
let _faceIdSupportedCache = false;
function faceIdSupported(){
  if(!_faceIdSupportedPromise){
    _faceIdSupportedPromise = (async ()=>{
      if(!isMobileDevice()) return false;
      if(!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
      try{ return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
      catch(e){ return false; }
    })();
    _faceIdSupportedPromise.then(v => { _faceIdSupportedCache = v; });
  }
  return _faceIdSupportedPromise;
}
// Sync read for render functions (which can't await) — populated by the
// async check above; callers that need certainty should await
// faceIdSupported() first (e.g. once, during initApp()).
function faceIdSupportedSync(){ return _faceIdSupportedCache; }

function getFaceIdEnrollment(){
  try{ return JSON.parse(localStorage.getItem(FACE_ID_KEY) || 'null'); }
  catch(e){ return null; }
}

function bufToBase64url(buf){
  let str = '';
  new Uint8Array(buf).forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlToBuf(b64url){
  const padded = b64url.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(b64url.length/4)*4, '=');
  const str = atob(padded);
  const buf = new Uint8Array(str.length);
  for(let i=0;i<str.length;i++) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

async function enrollFaceId(email, displayName){
  try{
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'ServisPro' },
        user: { id: userId, name: email, displayName: displayName || email },
        pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
        timeout: 60000,
      }
    });
    if(!cred) return false;
    const rawId = /** @type {any} */ (cred).rawId;
    localStorage.setItem(FACE_ID_KEY, JSON.stringify({ email, credentialId: bufToBase64url(rawId) }));
    localStorage.removeItem(FACE_ID_DISMISS_KEY);
    return true;
  }catch(e){ return false; }
}

async function tryFaceIdUnlock(){
  const enrolled = getFaceIdEnrollment();
  if(!enrolled) return false;
  try{
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64urlToBuf(enrolled.credentialId), type:'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      }
    });
    return !!assertion;
  }catch(e){ return false; }
}

function clearFaceId(){
  localStorage.removeItem(FACE_ID_KEY);
}

// Fire-and-forget, called once per fresh login (see handleAuthenticated in
// sync-engine.js) — offers to enroll only on a supported mobile device that
// isn't already enrolled and hasn't previously dismissed the offer.
async function maybeOfferFaceIdEnroll(session){
  const supported = await faceIdSupported();
  // The sidebar's Face ID settings button (chrome.js) reads faceIdSupportedSync(),
  // which only has a value once this promise resolves — re-render once it does
  // so the button shows up without waiting on some unrelated future render.
  if(state.currentStaff) render();
  if(!supported) return;
  if(localStorage.getItem(FACE_ID_DISMISS_KEY)) return;
  if(getFaceIdEnrollment()) return;
  if(!state.currentStaff || state.modal) return; // session moved on, or something else is already open
  setState({ modal: { type:'faceid-offer', email: session.user.email } });
}

function faceIdOfferModalHTML(email){
  const en = state.language==='en';
  return `
    <div style="width:50px;height:50px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 15px;">${ICONS.faceid}</div>
    <h2 style="text-align:center;">${en?'Use Face ID to log in faster?':'Guna Face ID untuk log masuk lebih pantas?'}</h2>
    <p style="text-align:center;">${en?'Next time you open the app on this phone, unlock with Face ID or fingerprint instead of typing your password. You can turn this off anytime.':'Lain kali anda buka app di telefon ini, buka dengan Face ID atau cap jari tanpa perlu taip kata laluan. Boleh matikan bila-bila masa.'}</p>
    <div class="modal-foot" style="justify-content:center;">
      <button class="btn btn-outline" data-action="skip-faceid-enroll">${en?'Not now':'Tidak sekarang'}</button>
      <button class="btn btn-primary" data-action="confirm-faceid-enroll" data-email="${esc(email)}">${en?'Enable Face ID':'Aktifkan Face ID'}</button>
    </div>
  `;
}

function faceIdSettingsModalHTML(){
  const en = state.language==='en';
  const enrolled = getFaceIdEnrollment();
  if(enrolled){
    return `
      <h2>${ICONS.faceid} Face ID</h2>
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,165,121,.12);border-radius:8px;padding:12px;margin-bottom:16px;">
        <span style="color:var(--success);">${ICONS.done}</span>
        <span style="font-size:13px;">${en?'Face ID quick unlock is active on this device.':'Face ID buka pantas aktif pada peranti ini.'}</span>
      </div>
      <p style="font-size:11.5px;color:var(--text-muted);">${en?'This only unlocks the app on this specific phone — it does not replace your password or 2FA anywhere else.':'Ini hanya membuka app pada telefon ini sahaja — tidak menggantikan kata laluan atau 2FA anda di tempat lain.'}</p>
      <div class="modal-foot">
        <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
        <button class="btn btn-danger" data-action="remove-faceid">${en?'Turn Off':'Matikan'}</button>
      </div>
    `;
  }
  return `
    <h2>${ICONS.faceid} Face ID</h2>
    <p style="font-size:12.5px;color:var(--text-muted);margin-top:0;">${en?'Unlock the app on this phone with Face ID or fingerprint instead of typing your password each time.':'Buka app di telefon ini dengan Face ID atau cap jari tanpa perlu taip kata laluan setiap kali.'}</p>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="close-modal">${t('btn_close')}</button>
      <button class="btn btn-primary" data-action="confirm-faceid-enroll" data-email="${esc(state.currentStaff?state.currentStaff.email||'':'')}">${en?'Enable Face ID':'Aktifkan Face ID'}</button>
    </div>
  `;
}
