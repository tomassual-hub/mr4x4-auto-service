function getOnboardingSteps(){
  const en = state.language==='en';
  return [
    {icon:ICONS.wrench, title: en?'Welcome to Mr 4x4 Auto Service!':'Selamat Datang ke Mr 4x4 Auto Service!',
      desc: en?'This quick tour shows the main parts of the system in under a minute.':'Tur ringkas ini tunjukkan bahagian utama sistem dalam masa kurang seminit.'},
    {icon:ICONS.jobs, title: en?'Job Cards':'Kad Kerja',
      desc: en?'Create a job card for every vehicle that comes in. Track its status from Waiting all the way to Delivered.':'Cipta kad kerja untuk setiap kenderaan yang masuk. Jejak statusnya dari Menunggu hingga Dihantar.'},
    {icon:ICONS.pos, title: en?'POS & Invoices':'POS & Invois',
      desc: en?'Sell parts and services, then generate an invoice. Inventory is deducted automatically at checkout.':'Jual alat ganti dan servis, kemudian jana invois. Inventori ditolak secara automatik semasa checkout.'},
    {icon:ICONS.inventory, title: en?'Inventory':'Inventori',
      desc: en?"Track stock levels — you'll see a warning badge in the sidebar when items run low.":'Jejak paras stok — anda akan nampak lencana amaran di sidebar bila item hampir habis.'},
    {icon:ICONS.settings, title: en?"You're All Set!":'Anda Sudah Bersedia!',
      desc: en?'Visit Settings anytime to adjust tax, loyalty discounts, or turn on Simple Mode for a cleaner everyday view.':'Lawati Tetapan bila-bila masa untuk laras cukai, diskaun setia, atau hidupkan Mod Ringkas untuk paparan harian lebih ringkas.'},
  ];
}

function finishOnboarding(){
  state.showOnboarding = false;
  render();
  try{ window.storage.set('onboarding-seen', '1', false); }catch(e){}
}

async function checkOnboarding(){
  try{
    await window.storage.get('onboarding-seen', false);
    // key exists -> already seen before, do nothing
  }catch(e){
    state.showOnboarding = true;
    state.onboardingStep = 0;
    render();
  }
}

function renderOnboarding(){
  const steps = getOnboardingSteps();
  const step = steps[state.onboardingStep];
  const isLast = state.onboardingStep === steps.length-1;
  const en = state.language==='en';
  return `<div class="modal-overlay" style="z-index:150;">
    <div class="modal" style="max-width:380px;text-align:center;">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(242,167,59,.15);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">${step.icon}</div>
      <h2>${step.title}</h2>
      <p style="font-size:13.5px;color:var(--text-muted);line-height:1.6;">${step.desc}</p>
      <div style="display:flex;gap:6px;justify-content:center;margin:16px 0;">
        ${steps.map((s,i)=>`<div style="width:7px;height:7px;border-radius:50%;background:${i===state.onboardingStep?'var(--accent)':'var(--border)'};"></div>`).join('')}
      </div>
      <div class="modal-foot" style="justify-content:center;">
        <button class="btn btn-outline" data-action="onboarding-skip">${en?'Skip':'Langkau'}</button>
        <button class="btn btn-primary" data-action="onboarding-next">${isLast?(en?'Get Started':'Mula Guna'):(en?'Next':'Seterusnya')}</button>
      </div>
    </div>
  </div>`;
}

function renderConfirmModal(){
  const c = state.confirmAction;
  return `<div class="modal-overlay" data-action="confirm-cancel"><div class="modal confirm-box" onclick="event.stopPropagation()">
    <div class="c-icon">${ICONS.alert}</div>
    <h2 style="text-align:center;">${c.title||(state.language==='en'?'Confirm Action':'Sahkan Tindakan')}</h2>
    <p>${c.message}</p>
    <div class="modal-foot">
      <button class="btn btn-outline" data-action="confirm-cancel">${t('btn_cancel')}</button>
      <button class="btn btn-danger" data-action="confirm-yes">${c.confirmLabel||t('btn_delete')}</button>
    </div>
  </div></div>`;
}

function askConfirm(message, onConfirm, opts){
  state.confirmAction = Object.assign({message, onConfirm}, opts||{});
  render();
}

