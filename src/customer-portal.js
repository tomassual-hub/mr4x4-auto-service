/* ============================= CUSTOMER PORTAL (quotation approval + invoice view) =============================
   Two more anonymous, token-gated screens shared with a customer via a
   direct link -- same shape as src/inspection-report.js's "Share Report"
   flow: ?quote=<id>&token=<quoteToken> or ?invoice=<id>&token=<invoiceToken>,
   no login required. See kiosk_get_quotation/kiosk_respond_quotation and
   kiosk_get_invoice in backend/schema.sql for the security-definer RPCs
   this screen calls -- both return only the minimal fields needed and
   verify the token server-side, so a stranger can't view/respond to a
   quotation or view an invoice just by guessing/enumerating ids. */
function renderQuotationApproval(){
  const en = state.language==='en';
  const q = state.quoteResult;
  let body;
  if(q==='loading' || !q){
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Loading your quotation…':'Memuatkan sebut harga anda…'}</p>`;
  } else if(q==='invalid'){
    body = `<div class="empty">${ICONS.alert}<div>${en?'This quotation link is invalid or has expired. Ask the workshop for a fresh link.':'Pautan sebut harga ini tidak sah atau telah tamat tempoh. Minta pautan baharu daripada bengkel.'}</div></div>`;
  } else {
    const statusNote = {
      accepted: en ? 'You approved this quotation. The workshop has been notified.' : 'Anda telah meluluskan sebut harga ini. Bengkel telah dimaklumkan.',
      rejected: en ? 'You rejected this quotation.' : 'Anda telah menolak sebut harga ini.',
      converted: en ? 'This quotation has already been converted to an invoice.' : 'Sebut harga ini telah ditukar kepada invois.',
      expired: en ? 'This quotation has expired. Contact the workshop for a new one.' : 'Sebut harga ini telah tamat tempoh. Hubungi bengkel untuk yang baharu.',
    };
    body = `
      <div style="text-align:left;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted);">${esc(q.quoteNo)}</div>
        <div style="font-size:16px;font-weight:700;margin:4px 0 12px;">${q.plate?esc(q.plate)+(q.model?' · '+esc(q.model):''):(q.customerName?esc(q.customerName):'')}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>${en?'Description':'Perkara'}</th><th style="text-align:center;">${en?'Qty':'Ktt'}</th><th style="text-align:right;">${en?'Amount':'Jumlah'}</th></tr></thead>
          <tbody>
            ${(q.items||[]).map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
          </tbody>
        </table></div>
        <div style="margin-top:10px;font-size:12.5px;">
          <div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Subtotal':'Subjumlah'}</span><span>${fmtRM(q.subtotal)}</span></div>
          ${q.discount>0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Discount':'Diskaun'}</span><span>-${fmtRM(q.discount)}</span></div>` : ''}
          ${q.tax>0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>SST</span><span>${fmtRM(q.tax)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;margin-top:4px;border-top:1px dashed var(--border);font-weight:700;font-size:15px;"><span>${en?'TOTAL':'JUMLAH'}</span><span>${fmtRM(q.total)}</span></div>
        </div>
        <div style="border-top:1px dashed var(--border);padding-top:14px;margin-top:14px;">
          ${q.status==='sent' ? `
            <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">${en?'Please review the estimate above and let us know if you\'d like to proceed.':'Sila semak anggaran di atas dan maklumkan jika anda ingin teruskan.'}</p>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline" style="flex:1;justify-content:center;" data-action="quote-reject">${en?'Reject':'Tolak'}</button>
              <button class="btn btn-primary" style="flex:1;justify-content:center;" data-action="quote-approve">${en?'Approve':'Luluskan'}</button>
            </div>
          ` : `<div style="text-align:center;font-size:12.5px;color:${q.status==='accepted'?'var(--success)':'var(--text-muted)'};">${q.status==='accepted'?ICONS.done+' ':''}${statusNote[q.status]||''}</div>`}
        </div>
      </div>`;
  }
  return `
  <div class="login-screen">
    <div class="login-box" style="max-width:380px;">
      <div class="login-brand">
        <div class="mark">${logoMarkHtml(112)}</div>
        <div class="sub">${en?'Service Quotation':'Sebut Harga Servis'}</div>
      </div>
      <div class="panel">${body}</div>
    </div>
  </div>`;
}

async function loadQuotationForApproval(){
  try{
    const { data, error } = await supabaseClient.rpc('kiosk_get_quotation', { p_quote_id: state.quoteId, p_token: state.quoteToken });
    if(error) throw error;
    state.quoteResult = data || 'invalid';
  }catch(e){
    reportError(e, 'Muatkan sebut harga gagal');
    state.quoteResult = 'invalid';
  }
  render();
}

function attachQuotationApprovalHandlers(){
  if(state.quoteResult==='loading' && !state.quoteResultLoading){
    state.quoteResultLoading = true;
    loadQuotationForApproval();
  }
  const respond = async (approved)=>{
    const en = state.language==='en';
    try{
      const { data: ok, error } = await supabaseClient.rpc('kiosk_respond_quotation', { p_quote_id: state.quoteId, p_token: state.quoteToken, p_approved: approved });
      if(error) throw error;
      if(ok){
        state.quoteResult = { ...state.quoteResult, status: approved ? 'accepted' : 'rejected' };
        render();
      } else {
        showToast(en ? 'This quotation can no longer be responded to.' : 'Sebut harga ini tidak boleh dijawab lagi.');
      }
    }catch(e){
      reportError(e, 'Hantar respons sebut harga gagal');
      showToast(en ? 'Could not send your response. Try again.' : 'Gagal hantar respons. Cuba lagi.');
    }
  };
  bindAction('quote-approve', ()=>respond(true));
  bindAction('quote-reject', ()=>respond(false));
}

/* ---------- INVOICE / RECEIPT VIEW ---------- */
function renderInvoiceView(){
  const en = state.language==='en';
  const inv = state.invoiceResult;
  let body;
  if(inv==='loading' || !inv){
    body = `<p style="text-align:center;color:var(--text-muted);">${en?'Loading your receipt…':'Memuatkan resit anda…'}</p>`;
  } else if(inv==='invalid'){
    body = `<div class="empty">${ICONS.alert}<div>${en?'This receipt link is invalid or has expired. Ask the workshop for a fresh link.':'Pautan resit ini tidak sah atau telah tamat tempoh. Minta pautan baharu daripada bengkel.'}</div></div>`;
  } else {
    body = `
      <div style="text-align:left;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted);">${esc(inv.invoiceNo)}</div>
        <div style="font-size:16px;font-weight:700;margin:4px 0 12px;">${inv.plate?esc(inv.plate)+(inv.model?' · '+esc(inv.model):''):(inv.customerName?esc(inv.customerName):'')}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>${en?'Description':'Perkara'}</th><th style="text-align:center;">${en?'Qty':'Ktt'}</th><th style="text-align:right;">${en?'Amount':'Jumlah'}</th></tr></thead>
          <tbody>
            ${(inv.items||[]).map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
          </tbody>
        </table></div>
        <div style="margin-top:10px;font-size:12.5px;">
          <div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Subtotal':'Subjumlah'}</span><span>${fmtRM(inv.subtotal)}</span></div>
          ${inv.discount>0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>${en?'Discount':'Diskaun'}</span><span>-${fmtRM(inv.discount)}</span></div>` : ''}
          ${inv.tax>0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>SST</span><span>${fmtRM(inv.tax)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;margin-top:4px;border-top:1px dashed var(--border);font-weight:700;font-size:15px;"><span>${en?'TOTAL':'JUMLAH'}</span><span>${fmtRM(inv.total)}</span></div>
        </div>
        <div style="border-top:1px dashed var(--border);padding-top:14px;margin-top:14px;">
          <button class="btn btn-primary" style="width:100%;justify-content:center;" data-action="print-kiosk-invoice">${ICONS.printer} ${en?'Print / Save as PDF':'Cetak / Simpan sebagai PDF'}</button>
        </div>
      </div>`;
  }
  return `
  <div class="login-screen">
    <div class="login-box" style="max-width:380px;">
      <div class="login-brand">
        <div class="mark">${logoMarkHtml(112)}</div>
        <div class="sub">${en?'Your Receipt':'Resit Anda'}</div>
      </div>
      <div class="panel">${body}</div>
    </div>
  </div>`;
}

async function loadInvoiceForCustomer(){
  try{
    const { data, error } = await supabaseClient.rpc('kiosk_get_invoice', { p_invoice_id: state.invoiceId, p_token: state.invoiceToken });
    if(error) throw error;
    state.invoiceResult = data || 'invalid';
  }catch(e){
    reportError(e, 'Muatkan invois gagal');
    state.invoiceResult = 'invalid';
  }
  render();
}

// Populates the same #print-area used by print.js's printInvoice(), but
// from the flattened kiosk RPC result rather than db.settings/getCustomer()
// -- this anonymous page never has the shop's own database loaded.
function printKioskInvoice(inv){
  const en = state.language==='en';
  const docTitle = inv.tax>0 ? (en?'TAX INVOICE':'INVOIS CUKAI') : (en?'INVOICE':'INVOIS');
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="print-invoice">
      <div class="pi-letterhead">
        <div>
          <h2>${esc(inv.shopName||'')}</h2>
          ${inv.shopAddress ? `<div class="pi-addr">${esc(inv.shopAddress).replace(/\n/g,'<br>')}</div>` : ''}
          ${inv.shopPhone ? `<div class="pi-addr">${esc(inv.shopPhone)}</div>` : ''}
        </div>
        <div class="pi-doc-meta">
          <div class="pi-doc-title">${docTitle}</div>
          <div class="pi-row"><span>${en?'No.':'No. Invois'}</span><span>${esc(inv.invoiceNo)}</span></div>
          <div class="pi-row"><span>${en?'Date':'Tarikh'}</span><span>${fmtDateTime(inv.createdAt)}</span></div>
        </div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-billto">
        <div class="pi-billto-label">${en?'Bill To':'Kepada'}</div>
        <div class="pi-billto-name">${inv.customerName?esc(inv.customerName):(en?'Walk-in Customer':'Pelanggan Walk-in')}</div>
        ${inv.plate ? `<div class="pi-addr">${esc(inv.plate)} — ${esc(inv.model||'')}</div>` : ''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>${en?'Description':'Perkara'}</th><th style="text-align:center;">${en?'Qty':'Kuantiti'}</th><th style="text-align:right;">${en?'Unit Price':'Harga Seunit'}</th><th style="text-align:right;">${en?'Amount':'Jumlah'}</th></tr></thead>
        <tbody>
          ${(inv.items||[]).map(it=>`<tr><td>${esc(it.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${fmtRM(it.price)}</td><td style="text-align:right;">${fmtRM(it.price*it.qty)}</td></tr>`).join('')}
        </tbody>
      </table></div>
      <div class="pi-totals">
        <div class="pi-row"><span>${en?'Subtotal':'Subjumlah'}</span><span>${fmtRM(inv.subtotal)}</span></div>
        ${inv.discount>0 ? `<div class="pi-row"><span>${en?'Discount':'Diskaun'}</span><span>-${fmtRM(inv.discount)}</span></div>` : ''}
        ${inv.tax>0 ? `<div class="pi-row"><span>SST (${inv.taxRate}%)</span><span>${fmtRM(inv.tax)}</span></div>` : ''}
        <div class="pi-row pi-total"><span>${en?'TOTAL':'JUMLAH'}</span><span>${fmtRM(inv.total)}</span></div>
      </div>
      <div class="pi-line"></div>
      <div class="pi-row"><span>${en?'Payment Method':'Kaedah Bayaran'}</span><span>${esc(inv.payment||'-')}</span></div>
      <div class="pi-foot">${en?'Thank you for your business.':'Terima kasih kerana menggunakan perkhidmatan kami.'}</div>
    </div>
  `;
  window.print();
}

function attachInvoiceViewHandlers(){
  if(state.invoiceResult==='loading' && !state.invoiceResultLoading){
    state.invoiceResultLoading = true;
    loadInvoiceForCustomer();
  }
  bindAction('print-kiosk-invoice', ()=>{
    if(state.invoiceResult && state.invoiceResult!=='loading' && state.invoiceResult!=='invalid'){
      printKioskInvoice(state.invoiceResult);
    }
  });
}

/* ============================= CUSTOMER PORTAL LOGIN (optional account) =============================
   Everything above this point works with NO account at all. This is the
   opt-in layer on top: a customer can register/log in to see all their
   vehicles/jobs/quotations/invoices/appointments in one dashboard instead
   of needing a fresh shared link every time (see the "Account" tab in
   src/login-kiosk.js's kiosk screen).

   Uses a SECOND, independent Supabase Auth client (own localStorage key)
   rather than the app's main `supabaseClient` -- that client's session
   drives the STAFF login flow in initApp()/handleAuthenticated() (see
   sync-engine.js), which assumes every session belongs to staff and does a
   full loadRemoteDB() the moment one exists. Sharing a session would mean
   a customer's login either gets rejected as "no staff record found"
   AFTER already pulling the whole shop database over the wire (RLS grants
   every authenticated session read access unless explicitly excluded --
   see is_customer() in backend/schema.sql), or worse, some future change
   accidentally treats a customer as staff. A separate client sidesteps all
   of that: this session is never seen by the staff login code at all. */
let customerAuthClient = null;
function getCustomerAuthClient(){
  if(!customerAuthClient){
    customerAuthClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: 'sb-customer-portal-auth' }
    });
  }
  return customerAuthClient;
}

// Called once when the "Account" tab is first opened -- checks for an
// already-active customer session (returning visitor) and, if found, loads
// straight into the dashboard instead of showing the login form.
async function checkCustPortalSession(){
  state.custPortalChecked = true;
  try{
    const { data:{ session } } = await getCustomerAuthClient().auth.getSession();
    if(session){
      await loadCustPortalProfile();
    }
  }catch(e){ /* no session / offline -- falls through to the login form */ }
  render();
}

async function loadCustPortalProfile(){
  const { data, error } = await getCustomerAuthClient().rpc('get_my_customer_profile');
  if(error){ reportError(error, 'Muatkan profil pelanggan gagal'); return; }
  if(data){
    state.custPortalProfile = data;
    state.custPortalMode = 'dashboard';
    loadCustPortalData();
  } else {
    // Logged in, but not linked to a customer record yet.
    state.custPortalMode = 'link';
  }
}

async function loadCustPortalData(){
  state.custPortalData = 'loading';
  render();
  try{
    const { data, error } = await getCustomerAuthClient().rpc('get_my_customer_data');
    if(error) throw error;
    state.custPortalData = data;
  }catch(e){
    reportError(e, 'Muatkan data pelanggan gagal');
    state.custPortalData = null;
  }
  render();
}

async function custPortalSignup(){
  const en = state.language==='en';
  const email = state.custPortalEmail.trim();
  const password = state.custPortalPassword;
  if(!email || !password){
    state.custPortalError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
    render();
    return;
  }
  if(password.length<6){
    state.custPortalError = en ? 'Password must be at least 6 characters.' : 'Kata laluan mesti sekurang-kurangnya 6 aksara.';
    render();
    return;
  }
  state.custPortalError = ''; state.custPortalNotice = ''; state.custPortalBusy = true;
  render();
  const { data, error } = await getCustomerAuthClient().auth.signUp({ email, password });
  state.custPortalBusy = false;
  if(error){
    state.custPortalError = error.message || (en ? 'Could not create account.' : 'Gagal mencipta akaun.');
    render();
    return;
  }
  if(data.session){
    state.custPortalMode = 'link';
  } else {
    state.custPortalMode = 'login';
    state.custPortalNotice = en ? 'Account created — check your email to confirm, then log in.' : 'Akaun dicipta — semak e-mel anda untuk sahkan, kemudian log masuk.';
  }
  render();
}

async function custPortalLogin(){
  const en = state.language==='en';
  const email = state.custPortalEmail.trim();
  const password = state.custPortalPassword;
  if(!email || !password){
    state.custPortalError = en ? 'Enter your email and password.' : 'Masukkan e-mel dan kata laluan.';
    render();
    return;
  }
  state.custPortalError = ''; state.custPortalBusy = true;
  render();
  const { error } = await getCustomerAuthClient().auth.signInWithPassword({ email, password });
  if(error){
    state.custPortalBusy = false;
    state.custPortalError = en ? 'Incorrect email or password.' : 'E-mel atau kata laluan salah.';
    render();
    return;
  }
  await loadCustPortalProfile();
  state.custPortalBusy = false;
  render();
}

async function custPortalForgotPassword(){
  const en = state.language==='en';
  const email = state.custPortalEmail.trim();
  if(!email){
    state.custPortalError = en ? 'Enter your email.' : 'Masukkan e-mel anda.';
    render();
    return;
  }
  state.custPortalError = ''; state.custPortalNotice = ''; state.custPortalBusy = true;
  render();
  const { error } = await getCustomerAuthClient().auth.resetPasswordForEmail(email);
  state.custPortalBusy = false;
  if(error){
    state.custPortalError = error.message || (en ? 'Could not send reset email.' : 'Gagal menghantar e-mel reset.');
    render();
    return;
  }
  state.custPortalNotice = en ? 'If that email has an account, a reset link has been sent.' : 'Jika e-mel itu ada akaun, pautan reset telah dihantar.';
  render();
}

async function custPortalLinkAccount(){
  const en = state.language==='en';
  const name = state.custPortalName.trim();
  const phone = state.custPortalPhone.trim();
  if(!phone){
    state.custPortalError = en ? 'Enter your phone number.' : 'Masukkan no. telefon anda.';
    render();
    return;
  }
  state.custPortalError = ''; state.custPortalBusy = true;
  render();
  try{
    const { data, error } = await getCustomerAuthClient().rpc('link_customer_account', { p_phone: phone, p_name: name || null });
    if(error) throw error;
    state.custPortalBusy = false;
    if(!data || !data.success){
      const reasons = {
        staff_account: en ? 'This email belongs to a staff account and can\'t also be used here.' : 'E-mel ini milik akaun staf dan tidak boleh digunakan di sini juga.',
        invalid_phone: en ? 'Enter a valid phone number.' : 'Masukkan no. telefon yang sah.',
      };
      state.custPortalError = (data && reasons[data.reason]) || (en ? 'Could not link your account.' : 'Gagal pautkan akaun anda.');
      render();
      return;
    }
    state.custPortalProfile = { id: data.customerId, name: data.name || name, phone };
    state.custPortalMode = 'dashboard';
    render();
    loadCustPortalData();
  }catch(e){
    state.custPortalBusy = false;
    reportError(e, 'Pautkan akaun pelanggan gagal');
    state.custPortalError = en ? 'Could not link your account. Try again.' : 'Gagal pautkan akaun. Cuba lagi.';
    render();
  }
}

async function custPortalLogout(){
  try{ await getCustomerAuthClient().auth.signOut(); }catch(e){ /* best-effort */ }
  state.custPortalMode = 'login';
  state.custPortalProfile = null;
  state.custPortalData = null;
  state.custPortalEmail = ''; state.custPortalPassword = ''; state.custPortalPhone = ''; state.custPortalName = '';
  render();
}

async function custPortalRespondQuotation(quoteId, approved){
  const en = state.language==='en';
  try{
    const { data: ok, error } = await getCustomerAuthClient().rpc('kiosk_respond_quotation', { p_quote_id: quoteId, p_approved: approved });
    if(error) throw error;
    if(ok){
      showToast(approved ? (en?'Quotation approved.':'Sebut harga diluluskan.') : (en?'Quotation rejected.':'Sebut harga ditolak.'));
      loadCustPortalData();
    } else {
      showToast(en ? 'This quotation can no longer be responded to.' : 'Sebut harga ini tidak boleh dijawab lagi.');
    }
  }catch(e){
    reportError(e, 'Hantar respons sebut harga gagal');
    showToast(en ? 'Could not send your response. Try again.' : 'Gagal hantar respons. Cuba lagi.');
  }
}

async function custPortalViewInvoice(invoiceId){
  const en = state.language==='en';
  try{
    const { data, error } = await getCustomerAuthClient().rpc('kiosk_get_invoice', { p_invoice_id: invoiceId });
    if(error) throw error;
    if(!data){
      showToast(en ? 'Could not open this invoice.' : 'Gagal buka invois ini.');
      return;
    }
    printKioskInvoice(data);
  }catch(e){
    reportError(e, 'Buka invois pelanggan gagal');
    showToast(en ? 'Could not open this invoice. Try again.' : 'Gagal buka invois ini. Cuba lagi.');
  }
}
