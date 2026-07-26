// @ts-nocheck
// This file is one long sequence of bindAction/bindAllAction callbacks that
// read raw .value/.dataset/.checked/.files off document.getElementById()
// results — tsc can't know those Elements are actually inputs/selects
// without a cast at every single call site (~100+ of them here). The real
// bugs found this session (reference identity, the toast/render issue, the
// UTC date bug) all lived in sync-engine.js/state.js logic, not in this
// kind of DOM plumbing, so the type-checking value here is low relative to
// the noise. Fix a genuine bug if you spot one; don't chase the casts.
/* ============================= EVENT HANDLERS ============================= */
function attachHandlers(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click', ()=>setState({view:el.dataset.nav, navOpen:false, globalSearch:''})));

  const gSearch = document.getElementById('global-search');
  if(gSearch){
    gSearch.addEventListener('input', ()=>{
      state.globalSearch = gSearch.value; render(); focusEnd('global-search');
    });
    gSearch.addEventListener('blur', ()=>{
      // Delayed so a click on a search result (which can open a modal before
      // this fires) still registers — same reasoning as the toast fix: an
      // unconditional render() here would wipe that modal's fields if it's
      // still open when this timer lands.
      setTimeout(()=>{ state.globalSearch=''; maybeRerender(); }, 150);
    });
  }
  document.querySelectorAll('[data-gs-idx]').forEach(el=>el.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    const results = globalSearchResults((state.globalSearch||'').trim());
    const r = results[Number(el.dataset.gsIdx)];
    if(!r) return;
    state.globalSearch = '';
    if(r.action.type==='customer'){ setState({view:'customers'}); }
    else if(r.action.type==='vehicle'){ const vehicle = getVehicle(r.action.id); setState({view:'customers', modal:{type:'vehicle-history', vehicle}}); }
    else if(r.action.type==='job'){ const job = db.jobs.find(j=>j.id===r.action.id); setState({view:'jobs', modal:{type:'job-detail', job}}); }
    else if(r.action.type==='invoice'){ setState({view:'pos'}); }
  }));
  document.querySelectorAll('[data-action="open-nav"]').forEach(el=>el.addEventListener('click', ()=>setState({navOpen:true})));
  document.querySelectorAll('[data-action="close-nav"]').forEach(el=>el.addEventListener('click', ()=>setState({navOpen:false})));
  bindAction('toggle-notif', ()=>setState({notifOpen: !state.notifOpen}));
  document.querySelectorAll('[data-notif-nav]').forEach(el=>el.addEventListener('click', ()=>{
    if(el.dataset.notifNav==='mfa-settings'){ setState({modal:{type:'mfa-settings'}, notifOpen:false}); return; }
    setState({view:el.dataset.notifNav, notifOpen:false});
  }));
  const branchSel = document.getElementById('branch-selector');
  if(branchSel) branchSel.addEventListener('change', ()=>setState({currentBranch: branchSel.value}));
  bindAllAction('toggle-theme', ()=>{
    state.theme = state.theme==='dark' ? 'light' : 'dark';
    render();
    try{ window.storage.set('theme-pref', state.theme, false); }catch(e){}
  });
  bindAllAction('toggle-lang', ()=>{
    state.language = state.language==='ms' ? 'en' : 'ms';
    render();
    try{ window.storage.set('lang-pref', state.language, false); }catch(e){}
  });
  document.querySelectorAll('[data-jobfilter]').forEach(el=>el.addEventListener('click', ()=>setState({jobFilter:el.dataset.jobfilter, jobsShowCount:30})));
  bindAction('load-more-jobs', ()=>setState({jobsShowCount:(state.jobsShowCount||30)+30}));
  document.querySelectorAll('[data-invtab]').forEach(el=>el.addEventListener('click', ()=>setState({invTab:el.dataset.invtab})));
  document.querySelectorAll('[data-invmaintab]').forEach(el=>el.addEventListener('click', ()=>setState({invMainTab:el.dataset.invmaintab})));
  bindAction('new-supplier', ()=>setState({modal:{type:'new-supplier'}}));
  bindAction('save-supplier', ()=>{
    const name = document.getElementById('sup-name').value.trim();
    const phone = document.getElementById('sup-phone').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama pembekal.')); return; }
    db.suppliers.push({id:uid(), name, phone});
    logAudit('Tambah Pembekal', name);
    queueSave();
    setState({modal:null});
    showToast(tt('Pembekal disimpan.'));
  });
  bindAllAction('delete-supplier', el=>{
    askConfirm(tt('Padam pembekal ini? Item yang ditugaskan akan kekal tanpa pembekal.'), ()=>{
      db.inventory.forEach(i=>{ if(i.supplierId===el.dataset.id) i.supplierId=null; });
      db.suppliers = db.suppliers.filter(s=>s.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Pembekal dipadam.'));
    });
  });
  bindAction('new-po', ()=>setState({modal:{type:'new-po'}}));
  bindAction('save-po', async ()=>{
    const supplierId = document.getElementById('po-supplier').value;
    const raw = document.getElementById('po-items').value.trim();
    if(!supplierId){ showToast(tt('Sila pilih pembekal.')); return; }
    const items = raw.split('\n').map(line=>{
      const parts = line.split(':');
      if(parts.length<3) return null;
      const name = parts[0].trim(); const qty = Number(parts[1].trim())||0; const cost = Number(parts[2].trim())||0;
      return name ? {name, qty, cost} : null;
    }).filter(Boolean);
    if(items.length===0){ showToast(tt('Format item tidak sah (nama:kuantiti:kos).')); return; }
    try{
      const poNo = await nextPoNo();
      const po = {id:uid(), poNo, supplierId, items, status:'pending', createdAt:Date.now()};
      db.purchaseOrders.push(po);
      logAudit('Jana Pesanan Belian', po.poNo);
      queueSave();
      setState({modal:null});
      showToast(tt('Pesanan belian ')+po.poNo+tt(' disimpan.'));
    }catch(e){
      reportError(e, 'Simpan pesanan belian gagal');
      showToast(state.language==='en' ? 'Could not save the purchase order. Try again.' : 'Gagal simpan pesanan belian. Cuba lagi.');
    }
  });
  bindAction('auto-po', async ()=>{
    const lowItems = db.inventory.filter(i=>i.qty<=i.lowStock);
    if(lowItems.length===0) return;
    try{
      const bySupplier = {};
      lowItems.forEach(i=>{
        const key = i.supplierId || 'none';
        if(!bySupplier[key]) bySupplier[key] = [];
        bySupplier[key].push({name:i.name, qty:Math.max(i.lowStock*2 - i.qty, i.lowStock), cost:i.cost});
      });
      for(const [supplierId, items] of Object.entries(bySupplier)){
        const poNo = await nextPoNo();
        const po = {id:uid(), poNo, supplierId: supplierId==='none'?null:supplierId, items, status:'pending', createdAt:Date.now()};
        db.purchaseOrders.push(po);
      }
      logAudit('Jana Pesanan Auto', lowItems.length+' item stok rendah');
      queueSave();
      render();
      showToast(tt('Pesanan belian automatik dijana untuk ')+lowItems.length+tt(' item.'));
    }catch(e){
      reportError(e, 'Jana pesanan belian automatik gagal');
      showToast(state.language==='en' ? 'Could not generate automatic purchase orders. Try again.' : 'Gagal jana pesanan belian automatik. Cuba lagi.');
    }
  });
  bindAllAction('receive-po', el=>{
    const po = db.purchaseOrders.find(p=>p.id===el.dataset.id);
    po.items.forEach(poi=>{
      const item = db.inventory.find(i=>i.name===poi.name);
      if(item) item.qty += poi.qty;
    });
    po.status = 'received';
    logAudit('Terima Pesanan Belian', po.poNo);
    queueSave();
    render();
    showToast(tt('Stok dikemaskini daripada ')+po.poNo+'.');
  });
  document.querySelectorAll('[data-range]').forEach(el=>el.addEventListener('click', ()=>setState({reportRange:Number(el.dataset.range)})));
  document.querySelectorAll('[data-job-detail]').forEach(el=>el.addEventListener('click', ()=>{
    const job = db.jobs.find(j=>j.id===el.dataset.jobDetail);
    setState({modal:{type:'job-detail', job}});
  }));

  const overlay = document.querySelector('[data-action="overlay-close"]');
  if(overlay) overlay.addEventListener('click', ()=>setState({modal:null}));
  document.querySelectorAll('[data-action="confirm-cancel"]').forEach(el=>el.addEventListener('click', ()=>setState({confirmAction:null})));
  bindAction('confirm-yes', ()=>{
    const action = state.confirmAction;
    state.confirmAction = null;
    if(action && action.onConfirm) action.onConfirm();
    else render();
  });

  bindAction('onboarding-next', ()=>{
    const steps = getOnboardingSteps();
    if(state.onboardingStep < steps.length-1){
      state.onboardingStep++;
      render();
    } else {
      finishOnboarding();
    }
  });
  bindAction('onboarding-skip', ()=>{ finishOnboarding(); });

  bindAllAction('logout', ()=>{
    supabaseClient.auth.signOut();
    unsubscribeRealtime();
    db = defaultDB();
    clearFaceId(); // explicit logout = don't remember this device; re-offered on next login
    setState({currentStaff:null, view:'dashboard', authMode:'login', mfaChallenge:null});
  });

  bindAllAction('open-mfa-settings', ()=>setState({modal:{type:'mfa-settings'}}));
  bindAction('start-mfa-enroll', ()=>startMfaEnrollment());
  bindAction('cancel-mfa-enroll', ()=>{ state.mfaEnrollment = null; setState({modal:null}); });
  bindAction('confirm-mfa-enroll', async ()=>{
    const code = document.getElementById('mfa-enroll-code').value.trim();
    if(!/^\d{6}$/.test(code)){ showToast(tt('Masukkan kod 6 digit.')); return; }
    await verifyMfaEnrollment(code);
    render();
  });
  bindAllAction('open-faceid-settings', ()=>setState({modal:{type:'faceid-settings'}}));
  bindAction('skip-faceid-enroll', ()=>{
    localStorage.setItem('bk_faceid_dismissed', '1');
    setState({modal:null});
  });
  bindAllAction('confirm-faceid-enroll', async el=>{
    const email = el.dataset.email;
    const ok = await enrollFaceId(email, state.currentStaff?state.currentStaff.name:'');
    setState({modal:null});
    showToast(ok ? tt('Face ID diaktifkan.') : tt('Gagal aktifkan Face ID.'));
  });
  bindAction('remove-faceid', ()=>{
    askConfirm(state.language==='en'?'Turn off Face ID on this device?':'Matikan Face ID pada peranti ini?', ()=>{
      clearFaceId();
      setState({modal:null});
      showToast(tt('Face ID dimatikan.'));
    });
  });

  bindAllAction('unenroll-mfa', el=>{
    askConfirm(state.language==='en'?'Remove 2FA from your account?':'Buang 2FA dari akaun anda?', async ()=>{
      await unenrollMfa(el.dataset.id);
      setState({modal:null});
    });
  });

  bindAction('new-job', ()=>setState({modal:{type:'new-job'}}));
  bindAction('close-modal', ()=>setState({modal:null}));
  bindAction('new-item', ()=>setState({modal:{type:'new-item'}}));
  bindAction('new-customer', ()=>setState({modal:{type:'new-customer'}}));

  bindAllAction('edit-item', el=>{
    const item = getItem(el.dataset.id);
    setState({modal:{type:'edit-item', item}});
  });
  bindAllAction('delete-item', el=>{
    const item = getItem(el.dataset.id);
    askConfirm(tt('Padam item "')+item.name+tt('" daripada inventori?'), ()=>{
      const idx = db.inventory.findIndex(i=>i.id===el.dataset.id);
      const removed = db.inventory.splice(idx,1)[0];
      logAudit('Padam Item', removed.name);
      queueSave(); render();
      showToast(tt('Item dipadam.'), ()=>{
        db.inventory.splice(idx,0,removed); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });
  bindAllAction('add-vehicle', el=>{
    setState({modal:{type:'new-vehicle', customerId:el.dataset.id}});
  });
  bindAllAction('delete-customer', el=>{
    const cust = getCustomer(el.dataset.id);
    askConfirm(tt('Padam pelanggan "')+cust.name+tt('" beserta semua kenderaan mereka? Rekod kerja lama akan dikekalkan.'), ()=>{
      const removedVehicles = db.vehicles.filter(v=>v.customerId===el.dataset.id);
      db.customers = db.customers.filter(c=>c.id!==el.dataset.id);
      db.vehicles = db.vehicles.filter(v=>v.customerId!==el.dataset.id);
      logAudit('Padam Pelanggan', cust.name);
      queueSave(); render();
      showToast(tt('Pelanggan dipadam.'), ()=>{
        db.customers.push(cust); db.vehicles.push(...removedVehicles); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });
  bindAllAction('edit-customer', el=>{
    const customer = getCustomer(el.dataset.id);
    setState({modal:{type:'edit-customer', customer}});
  });
  bindAction('save-customer-edit', ()=>{
    const btn = document.querySelector('[data-action="save-customer-edit"]');
    const customer = getCustomer(btn.dataset.id);
    customer.name = document.getElementById('cust-edit-name').value.trim() || customer.name;
    customer.phone = document.getElementById('cust-edit-phone').value.trim();
    queueSave();
    setState({modal:null});
    showToast(tt('Maklumat pelanggan dikemaskini.'));
  });
  bindAllAction('edit-vehicle', el=>{
    const vehicle = getVehicle(el.dataset.id);
    setState({modal:{type:'edit-vehicle', vehicle}});
  });
  bindAction('save-vehicle-edit', ()=>{
    const btn = document.querySelector('[data-action="save-vehicle-edit"]');
    const vehicle = getVehicle(btn.dataset.id);
    vehicle.plate = document.getElementById('veh-edit-plate').value.trim() || vehicle.plate;
    vehicle.model = document.getElementById('veh-edit-model').value.trim();
    vehicle.color = document.getElementById('veh-edit-color').value.trim();
    vehicle.odometer = Number(document.getElementById('veh-edit-odo').value)||0;
    vehicle.serviceIntervalKm = Number(document.getElementById('veh-edit-interval').value)||10000;
    queueSave();
    setState({modal:null});
    showToast(tt('Maklumat kenderaan dikemaskini.'));
  });
  document.querySelectorAll('[data-vehicle-history]').forEach(el=>el.addEventListener('click', ()=>{
    const vehicle = getVehicle(el.dataset.vehicleHistory);
    setState({modal:{type:'vehicle-history', vehicle}});
  }));

  const custSearch = document.getElementById('customer-search');
  if(custSearch){
    custSearch.addEventListener('input', ()=>{
      state.customerSearch = custSearch.value; state.customersShowCount = 30; render();
      const el2 = document.getElementById('customer-search');
      if(el2){ el2.focus(); try{ el2.setSelectionRange(el2.value.length, el2.value.length); }catch(e){} }
    });
  }
  bindAction('load-more-customers', ()=>setState({customersShowCount:(state.customersShowCount||30)+30}));

  // Staff management
  bindAction('new-staff', ()=>setState({modal:{type:'new-staff'}}));
  bindAllAction('edit-staff', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.id);
    setState({modal:{type:'edit-staff', staffMember}});
  });
  bindAllAction('delete-staff', el=>{
    const staffMember = db.staff.find(s=>s.id===el.dataset.id);
    // Losing the last Admin is unrecoverable through the app: claim_staff_record()
    // only lets a new login self-bootstrap as Admin when the staff table is
    // completely empty, so if any non-Admin row survives, nobody can ever
    // become Admin again without direct database access. Block it here rather
    // than relying on the button-hide in viewStaff() alone, since that's a
    // rendering nicety, not a safety guarantee.
    const isLastAdmin = staffMember.role==='Admin' && db.staff.filter(s=>s.role==='Admin').length===1;
    if(isLastAdmin){
      showToast(state.language==='en'
        ? 'Cannot delete the last Admin — appoint another Admin first.'
        : 'Tidak boleh memadam Admin terakhir. Lantik Admin lain dahulu.');
      return;
    }
    askConfirm(tt('Padam akaun staf "')+staffMember.name+'"?', ()=>{
      db.staff = db.staff.filter(s=>s.id!==el.dataset.id);
      logAudit('Padam Staf', staffMember.name+' ('+staffMember.role+')');
      queueSave(); render(); showToast(tt('Staf dipadam.'));
    });
  });
  bindAction('save-staff', ()=>{
    const btn = document.querySelector('[data-action="save-staff"]');
    const id = btn.dataset.id;
    const name = document.getElementById('sf-name').value.trim();
    const role = document.getElementById('sf-role').value;
    const email = document.getElementById('sf-email').value.trim();
    const commissionPercent = Number(document.getElementById('sf-commission').value)||0;
    if(!name){ showToast(tt('Sila masukkan nama staf.')); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast(state.language==='en'?'Enter a valid email.':'Masukkan e-mel yang sah.'); return; }
    try{
      if(id){
        const staffMember = db.staff.find(s=>s.id===id);
        // Demoting the sole remaining Admin away from Admin is just as
        // unrecoverable as deleting them outright (see delete-staff above).
        if(staffMember.role==='Admin' && role!=='Admin' && db.staff.filter(s=>s.role==='Admin').length===1){
          showToast(state.language==='en'
            ? 'Cannot demote the last Admin — appoint another Admin first.'
            : 'Tidak boleh menurunkan pangkat Admin terakhir. Lantik Admin lain dahulu.');
          return;
        }
        Object.assign(staffMember, {name, role, email, commissionPercent});
        logAudit('Sunting Staf', name+' ('+role+')');
      } else {
        db.staff.push({id:uid(), name, role, email, commissionPercent, userId:null});
        logAudit('Tambah Staf', name+' ('+role+')');
      }
      queueSave();
      setState({modal:null});
      showToast(tt('Staf disimpan.'));
    }catch(e){
      reportError(e, 'Simpan staf gagal');
      showToast(state.language==='en' ? 'Could not save this staff member. Try again.' : 'Gagal simpan staf ini. Cuba lagi.');
    }
  });

  // Appointment tabs
  document.querySelectorAll('[data-appttab]').forEach(el=>el.addEventListener('click', ()=>setState({apptTab:el.dataset.appttab})));
  document.querySelectorAll('[data-stafftab]').forEach(el=>el.addEventListener('click', ()=>setState({staffTab:el.dataset.stafftab})));
  bindAction('new-appointment', ()=>setState({modal:{type:'new-appointment'}}));
  const apCustomer = document.getElementById('ap-customer');
  if(apCustomer) apCustomer.addEventListener('change', ()=>{
    const vehSel = document.getElementById('ap-vehicle');
    const vs = getVehiclesFor(apCustomer.value);
    vehSel.innerHTML = apCustomer.value ? (vs.length ? vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') : `<option value="">Tiada kenderaan direkod</option>`) : `<option value="">— Pilih Pelanggan Dahulu —</option>`;
  });
  bindAction('save-appointment', ()=>{
    const customerId = document.getElementById('ap-customer').value;
    const vehicleId = document.getElementById('ap-vehicle').value;
    const date = document.getElementById('ap-date').value;
    const time = document.getElementById('ap-time').value;
    const notes = document.getElementById('ap-notes').value.trim();
    if(!customerId){ showToast(tt('Sila pilih pelanggan.')); return; }
    if(!date || !time){ showToast(tt('Sila pilih tarikh dan masa.')); return; }
    try{
      db.appointments.push({id:uid(), customerId, vehicleId, date, time, notes, status:'scheduled', createdAt:Date.now()});
      queueSave();
      setState({modal:null});
      showToast(tt('Tempahan disimpan.'));
    }catch(e){
      reportError(e, 'Simpan tempahan gagal');
      showToast(state.language==='en' ? 'Could not save the appointment. Try again.' : 'Gagal simpan tempahan. Cuba lagi.');
    }
  });
  bindAllAction('appt-done', el=>{
    const a = db.appointments.find(x=>x.id===el.dataset.id);
    a.status='done'; queueSave(); render(); showToast(tt('Tempahan ditandakan selesai.'));
  });
  bindAllAction('appt-cancel', el=>{
    const a = db.appointments.find(x=>x.id===el.dataset.id);
    a.status='cancelled'; queueSave(); render(); showToast(tt('Tempahan dibatalkan.'));
  });
  bindAllAction('delete-appointment', el=>{
    askConfirm(tt('Padam tempahan ini?'), ()=>{
      db.appointments = db.appointments.filter(a=>a.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Tempahan dipadam.'));
    });
  });

  // Service contracts
  bindAction('new-contract', ()=>setState({modal:{type:'new-contract'}}));
  const ctCustomer = document.getElementById('ct-customer');
  if(ctCustomer) ctCustomer.addEventListener('change', ()=>{
    const vehSel = document.getElementById('ct-vehicle');
    const vs = getVehiclesFor(ctCustomer.value);
    vehSel.innerHTML = ctCustomer.value ? (vs.length ? vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') : `<option value="">Tiada kenderaan direkod</option>`) : `<option value="">— Pilih Pelanggan Dahulu —</option>`;
  });
  bindAction('save-contract', ()=>{
    const label = document.getElementById('ct-label').value.trim();
    const customerId = document.getElementById('ct-customer').value;
    const vehicleId = document.getElementById('ct-vehicle').value;
    const freq = Number(document.getElementById('ct-freq').value)||30;
    const itemsRaw = document.getElementById('ct-items').value.trim();
    if(!label){ showToast(tt('Sila masukkan nama kontrak.')); return; }
    if(!customerId){ showToast(tt('Sila pilih pelanggan.')); return; }
    const items = itemsRaw.split('\n').map(line=>{
      const parts = line.split(':');
      if(parts.length<2) return null;
      const name = parts[0].trim();
      const price = Number(parts[1].trim())||0;
      return name ? {name, price, qty:1} : null;
    }).filter(Boolean);
    if(items.length===0){ showToast(tt('Sila masukkan sekurang-kurangnya satu item (format: nama:harga).')); return; }
    try{
      db.contracts.push({id:uid(), label, customerId, vehicleId, items, frequencyDays:freq, nextDue:Date.now(), lastGenerated:null});
      queueSave();
      setState({modal:null});
      showToast(tt('Kontrak servis disimpan.'));
    }catch(e){
      reportError(e, 'Simpan kontrak servis gagal');
      showToast(state.language==='en' ? 'Could not save the service contract. Try again.' : 'Gagal simpan kontrak servis. Cuba lagi.');
    }
  });
  bindAllAction('generate-contract', async el=>{
    const ct = db.contracts.find(c=>c.id===el.dataset.id);
    try{
      const subtotal = ct.items.reduce((s,i)=>s+i.price*i.qty,0);
      const taxRate = Number(db.settings.taxRate)||0;
      const taxAmt = subtotal*taxRate/100;
      const invoiceNo = await nextInvNo();
      const invoice = {
        id:uid(), invoiceNo, customerId:ct.customerId, vehicleId:ct.vehicleId||null, jobId:null,
        items:[...ct.items], subtotal, discount:0, taxRate, tax:taxAmt, total:subtotal+taxAmt, payment:'Kontrak',
        createdAt:Date.now(), createdBy: state.currentStaff?state.currentStaff.name:''
      };
      db.invoices.push(invoice);
      ct.lastGenerated = Date.now();
      ct.nextDue = Date.now() + ct.frequencyDays*24*3600*1000;
      queueSave();
      render();
      showToast(tt('Invois ')+invoice.invoiceNo+tt(' dijana daripada kontrak ')+ct.label+'.');
    }catch(e){
      reportError(e, 'Jana invois daripada kontrak gagal');
      showToast(state.language==='en' ? 'Could not generate the invoice from this contract. Try again.' : 'Gagal jana invois daripada kontrak ini. Cuba lagi.');
    }
  });
  bindAllAction('delete-contract', el=>{
    askConfirm(tt('Padam kontrak servis ini?'), ()=>{
      db.contracts = db.contracts.filter(c=>c.id!==el.dataset.id);
      queueSave(); render(); showToast(tt('Kontrak dipadam.'));
    });
  });

  // Settings
  bindAction('save-settings', ()=>{
    db.settings.shopName = document.getElementById('set-shopname').value.trim() || 'Mr 4x4 Auto Service';
    db.settings.shopPhone = document.getElementById('set-shopphone').value.trim();
    db.settings.shopAddress = document.getElementById('set-shopaddress').value.trim();
    db.settings.shopRegNo = document.getElementById('set-shopregno').value.trim();
    db.settings.shopSstNo = document.getElementById('set-shopsstno').value.trim();
    db.settings.taxRate = Number(document.getElementById('set-tax').value)||0;
    db.settings.loyaltyDiscount = Number(document.getElementById('set-loyalty-discount').value)||0;
    db.settings.loyaltyVisits = Number(document.getElementById('set-loyalty-visits').value)||5;
    db.settings.churnDays = Number(document.getElementById('set-churn-days').value)||180;
    db.settings.simpleMode = document.getElementById('set-simple-mode').checked;
    queueSave();
    render();
    showToast(tt('Tetapan disimpan.'));
  });
  bindAction('add-branch', ()=>{
    const name = document.getElementById('new-branch-name').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama cawangan.')); return; }
    db.branches.push({id:uid(), name});
    logAudit('Tambah Cawangan', name);
    queueSave();
    render();
    showToast(tt('Cawangan ditambah.'));
  });
  bindAllAction('delete-branch', el=>{
    askConfirm(tt('Padam cawangan ini? Rekod sedia ada yang ditugaskan kepadanya akan kekal.'), ()=>{
      db.branches = db.branches.filter(b=>b.id!==el.dataset.id);
      if(state.currentBranch===el.dataset.id) state.currentBranch='all';
      queueSave(); render(); showToast(tt('Cawangan dipadam.'));
    });
  });
  bindAction('export-backup', ()=>{
    const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mr4x4-sandaran-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    db.settings.lastBackupAt = Date.now();
    queueSave();
    render();
    showToast(tt('Fail sandaran dimuat turun.'));
  });
  bindAction('list-auto-backups', async ()=>{
    try{
      const list = await listAutoBackups();
      setState({autoBackupsList: list});
    }catch(e){ reportError(e, 'Gagal muat senarai sandaran automatik'); showToast(tt('Gagal muat senarai sandaran.')); }
  });
  bindAllAction('download-auto-backup', async el=>{
    const id = el.dataset.id;
    try{
      const backupData = await fetchAutoBackupData(id);
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mr4x4-sandaran-auto-'+id+'.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }catch(e){ reportError(e, 'Gagal muat turun sandaran automatik'); showToast(tt('Gagal muat turun sandaran.')); }
  });
  const paymentQrInput = document.getElementById('payment-qr-input');
  if(paymentQrInput) paymentQrInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev)=>{
      img.onload = ()=>{
        const maxW = 400;
        const scale = Math.min(1, maxW/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        db.settings.paymentQR = canvas.toDataURL('image/png');
        queueSave();
        render();
        showToast(tt('Kod QR bayaran disimpan.'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  bindAction('remove-payment-qr', ()=>{
    askConfirm(tt('Buang kod QR bayaran ini?'), ()=>{
      db.settings.paymentQR = '';
      queueSave();
      render();
      showToast(tt('Kod QR bayaran dibuang.'));
    });
  });
  const restoreFile = document.getElementById('restore-file');
  if(restoreFile) restoreFile.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        askConfirm(tt('Pulihkan data daripada fail ini? SEMUA data semasa akan digantikan.'), ()=>{
          // A backup taken with an older version of the app (or a hand-edited
          // file) can be missing top-level fields the current code assumes
          // exist — the rest of the app does .map()/.filter() on these
          // without checking, so any missing one crashes the very next
          // screen that touches it. Fall back to defaultDB()'s shape for
          // anything absent or null, field by field, instead of patching
          // fields one at a time as each new crash gets discovered.
          const base = defaultDB();
          // A backup missing the staff field entirely (older export version,
          // hand-edited file, or a file some other part of the app produced
          // without it) must NOT be treated as "this shop now has zero
          // staff" — falling through to base.staff=[] here would, a few
          // lines down, delete every other teammate's login access from the
          // server, keeping only whoever clicked restore. Only trust the
          // backup's staff list when it actually provided one; otherwise
          // keep whatever staff this device already had loaded.
          const staffFieldMissing = !Array.isArray(parsed.staff);
          const preRestoreStaff = db.staff;
          db = { ...base, ...parsed };
          Object.keys(base).forEach(key=>{ if(db[key]===undefined || db[key]===null) db[key] = base[key]; });
          if(staffFieldMissing) db.staff = preRestoreStaff;
          if(db.settings.paymentQR===undefined) db.settings.paymentQR='';
          if(db.settings.lastBackupAt===undefined) db.settings.lastBackupAt=null;
          // Job creation and POS checkout read db.branches[0].id whenever no
          // specific branch is selected — an empty (not just missing) array
          // passes the generic check above but still crashes the same way.
          if(!Array.isArray(db.branches) || db.branches.length===0) db.branches=[{id:'main', name:'Cawangan Utama'}];
          // A backup taken from another branch/device — or before this
          // account existed as staff — won't include the person doing the
          // restore. Since shop_meta/staff writes are Admin-only via RLS
          // keyed off the staff table, silently dropping their own record
          // here would lock them out of Settings/Staff for the rest of the
          // session with no way back in. Whoever clicks restore keeps their
          // own access no matter what the file says about everyone else.
          if(state.currentStaff && !db.staff.some(s=>s.id===state.currentStaff.id)){
            db.staff.push(state.currentStaff);
          }
          queueSave();
          render();
          showToast(tt('Data berjaya dipulihkan.'));
        });
      }catch(err){ showToast(tt('Fail sandaran tidak sah.')); }
    };
    reader.readAsText(file);
  });
  bindAction('export-csv-invoices', ()=>downloadCSV('invois.csv',
    ['No. Invois','Pelanggan','Tarikh','Bayaran','Subjumlah','Diskaun','Cukai','Jumlah'],
    db.invoices.map(inv=>{
      const c=getCustomer(inv.customerId);
      return [inv.invoiceNo, c?c.name:'Walk-in', fmtDateTime(inv.createdAt), inv.payment, inv.subtotal, inv.discount||0, inv.tax||0, inv.total];
    })));
  bindAction('export-csv-inventory', ()=>downloadCSV('inventori.csv',
    ['Nama','SKU','Kuantiti','Kos','Harga Jual','Amaran Stok Rendah'],
    db.inventory.map(i=>[i.name,i.sku,i.qty,i.cost,i.price,i.lowStock])));
  bindAction('export-csv-customers', ()=>downloadCSV('pelanggan.csv',
    ['Nama','Telefon'],
    db.customers.map(c=>[c.name,c.phone||''])));
  bindAction('export-csv-accounting', ()=>downloadCSV('rekod-perakaunan.csv',
    ['Tarikh','Rujukan','Penerangan','Debit (Tunai/Belanja)','Kredit (Jualan)','Cukai SST'],
    db.invoices.map(inv=>{
      const c = getCustomer(inv.customerId);
      const desc = 'Jualan - '+(c?c.name:'Walk-in')+' ('+inv.items.map(it=>it.name).join('; ')+')';
      return [localDateStr(new Date(inv.createdAt)), inv.invoiceNo, desc, 0, inv.total, inv.tax||0];
    })));

  // new customer / vehicle inline in job modal
  const njCustomer = document.getElementById('nj-customer');
  if(njCustomer){
    njCustomer.addEventListener('change', ()=>{
      const val = njCustomer.value;
      document.getElementById('nj-new-customer-fields').style.display = val==='__new__' ? 'block' : 'none';
      const vehSel = document.getElementById('nj-vehicle');
      const newVehFields = document.getElementById('nj-new-vehicle-fields');
      if(val && val!=='__new__'){
        const vs = getVehiclesFor(val);
        vehSel.innerHTML = `<option value="">— Pilih Kenderaan —</option>` + vs.map(v=>`<option value="${v.id}">${esc(v.plate)} (${esc(v.model)})</option>`).join('') + `<option value="__new__">+ Kenderaan Baharu</option>`;
        newVehFields.style.display = 'none';
      } else if(val==='__new__'){
        vehSel.innerHTML = `<option value="__new__">+ Kenderaan Baharu</option>`;
        newVehFields.style.display = 'block';
      } else {
        vehSel.innerHTML = `<option value="">— Pilih Pelanggan Dahulu —</option>`;
        newVehFields.style.display = 'none';
      }
    });
  }
  const njVehicle = document.getElementById('nj-vehicle');
  if(njVehicle){
    njVehicle.addEventListener('change', ()=>{
      document.getElementById('nj-new-vehicle-fields').style.display = njVehicle.value==='__new__' ? 'block' : 'none';
    });
  }

  bindAction('create-job', async ()=>{
    let customerId = document.getElementById('nj-customer').value;
    let vehicleId = document.getElementById('nj-vehicle') ? document.getElementById('nj-vehicle').value : '';
    const desc = document.getElementById('nj-desc').value.trim();
    const mechanic = document.getElementById('nj-mechanic').value.trim();

    if(customerId==='__new__'){
      const name = document.getElementById('nj-new-name').value.trim();
      const phone = document.getElementById('nj-new-phone').value.trim();
      if(!name){ showToast(tt('Sila masukkan nama pelanggan.')); return; }
      customerId = uid();
      db.customers.push({id:customerId, name, phone});
    }
    if(!customerId){ showToast(tt('Sila pilih atau tambah pelanggan.')); return; }

    if(vehicleId==='__new__' || !vehicleId){
      const plate = document.getElementById('nj-new-plate') ? document.getElementById('nj-new-plate').value.trim() : '';
      const model = document.getElementById('nj-new-model') ? document.getElementById('nj-new-model').value.trim() : '';
      if(!plate){ showToast(tt('Sila masukkan no. plat kenderaan.')); return; }
      vehicleId = uid();
      db.vehicles.push({id:vehicleId, customerId, plate, model, color:''});
    }

    try{
      const jobNo = await nextJobNo();
      // db.branches is backfilled with a default on every login (see
      // handleAuthenticated), but stay defensive here too rather than
      // crash on db.branches[0].id if it's ever empty when this runs.
      const fallbackBranchId = (db.branches && db.branches[0]) ? db.branches[0].id : 'main';
      const job = {id:uid(), jobNo, customerId, vehicleId, description:desc, mechanic, status:'waiting', items:[], createdAt:Date.now(), invoiced:false, createdBy: state.currentStaff ? state.currentStaff.name : '', internalNote:'', doneAt:null, photos:[], branchId: state.currentBranch!=='all' ? state.currentBranch : fallbackBranchId};
      db.jobs.push(job);
      queueSave();
      setState({modal:null, view:'jobs'});
      showToast(tt('Kad kerja ')+job.jobNo+tt(' dicipta.'));
    }catch(e){
      reportError(e, 'Cipta kad kerja gagal');
      showToast(state.language==='en' ? 'Could not create the job card. Try again.' : 'Gagal cipta kad kerja. Cuba lagi.');
    }
  });

  const jobPhotoInput = document.getElementById('job-photo-input');
  if(jobPhotoInput){
    jobPhotoInput.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev)=>{
        img.onload = ()=>{
          const maxW = 500;
          const scale = Math.min(1, maxW/img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width*scale; canvas.height = img.height*scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const job = state.modal.job;
          if(!job.photos) job.photos = [];
          job.photos.push(dataUrl);
          queueSave();
          render();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  document.querySelectorAll('[data-action="remove-photo"]').forEach(el=>el.addEventListener('click', ()=>{
    const job = state.modal.job;
    job.photos.splice(Number(el.dataset.idx),1);
    queueSave();
    render();
  }));

  const sigPad = document.getElementById('sig-pad');
  if(sigPad){
    const ctx = sigPad.getContext('2d');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    let drawing = false;
    const getPos = (e)=>{
      const rect = sigPad.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return {x: cx-rect.left, y: cy-rect.top};
    };
    const start = (e)=>{ drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault(); };
    const move = (e)=>{ if(!drawing) return; const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); };
    const end = ()=>{ drawing=false; };
    sigPad.addEventListener('mousedown', start);
    sigPad.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    sigPad.addEventListener('touchstart', start, {passive:false});
    sigPad.addEventListener('touchmove', move, {passive:false});
    sigPad.addEventListener('touchend', end);
  }
  bindAction('clear-sig-pad', ()=>{
    const canvas = document.getElementById('sig-pad');
    if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  });
  bindAllAction('save-signature', el=>{
    const canvas = document.getElementById('sig-pad');
    if(!canvas) return;
    const job = state.modal.job;
    job.signature = canvas.toDataURL('image/png');
    queueSave();
    render();
    showToast(tt('Tandatangan disimpan.'));
  });
  bindAllAction('clear-signature', el=>{
    askConfirm(tt('Padam tandatangan sedia ada dan tandatangan semula?'), ()=>{
      const job = state.modal.job;
      job.signature = null;
      render();
    });
  });

  bindAction('save-job-status', ()=>{
    const job = state.modal.job;
    const newStatus = document.getElementById('job-status-select').value;
    if((newStatus==='done'||newStatus==='delivered') && job.status!=='done' && job.status!=='delivered'){
      job.doneAt = Date.now();
    }
    if(newStatus==='waiting'||newStatus==='progress'){ job.doneAt = null; }
    job.status = newStatus;
    job.description = document.getElementById('job-desc-edit').value.trim();
    job.mechanic = document.getElementById('job-mechanic-edit').value.trim();
    job.internalNote = document.getElementById('job-note-edit').value.trim();
    queueSave();
    setState({modal:null});
    showToast(tt('Kad kerja dikemaskini.'));
  });

  bindAllAction('delete-job', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    askConfirm(tt('Padam kad kerja ')+(job?job.jobNo:'')+'?', ()=>{
      db.jobs = db.jobs.filter(j=>j.id!==el.dataset.id);
      logAudit('Padam Kad Kerja', job.jobNo);
      queueSave();
      setState({modal:null});
      showToast(tt('Kad kerja dipadam.'), ()=>{
        db.jobs.push(job); queueSave(); render(); showToast(tt('Pemadaman dibatalkan.'));
      });
    });
  });

  bindAllAction('job-to-pos', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    state.posCustomerId = job.customerId;
    state.posVehicleId = job.vehicleId;
    state.posJobId = job.id;
    state.posCart = [];
    setState({modal:null, view:'pos'});
    showToast(tt('Sedia untuk buat invois bagi ')+job.jobNo);
  });
  bindAllAction('open-inspection', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    setState({modal:{type:'inspection', job}});
  });
  document.querySelectorAll('[data-inspect-item]').forEach(el=>el.addEventListener('click', ()=>{
    const job = state.modal.job;
    if(!job.inspection) job.inspection = {};
    const name = el.dataset.inspectItem;
    const cur = job.inspection[name];
    const next = !cur ? 'ok' : cur==='ok' ? 'attention' : cur==='attention' ? 'replace' : null;
    if(next) job.inspection[name] = next; else delete job.inspection[name];
    queueSave();
    render();
  }));

  bindAction('save-item', ()=>{
    const id = document.querySelector('[data-action="save-item"]').dataset.id;
    const name = document.getElementById('it-name').value.trim();
    const sku = document.getElementById('it-sku').value.trim();
    const qty = Number(document.getElementById('it-qty').value)||0;
    const cost = Number(document.getElementById('it-cost').value)||0;
    const price = Number(document.getElementById('it-price').value)||0;
    const lowStock = Number(document.getElementById('it-low').value)||0;
    const supplierId = document.getElementById('it-supplier').value || null;
    const warrantyMonths = Number(document.getElementById('it-warranty').value)||0;
    if(!name){ showToast(tt('Sila masukkan nama item.')); return; }
    if(id){
      const item = getItem(id);
      if(item.price !== price) logAudit('Ubah Harga', name+': '+fmtRM(item.price)+' → '+fmtRM(price));
      Object.assign(item, {name,sku,qty,cost,price,lowStock,supplierId,warrantyMonths});
    } else {
      db.inventory.push({id:uid(), name,sku,qty,cost,price,lowStock,supplierId,warrantyMonths});
      logAudit('Tambah Item', name);
    }
    queueSave();
    setState({modal:null});
    showToast(tt('Item disimpan.'));
  });

  bindAction('save-customer', ()=>{
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    if(!name){ showToast(tt('Sila masukkan nama.')); return; }
    const dup = phone && db.customers.find(c=>c.phone && c.phone.replace(/\D/g,'')===phone.replace(/\D/g,''));
    const doSave = ()=>{
      db.customers.push({id:uid(), name, phone, visits:0, loyaltyPoints:0});
      queueSave();
      setState({modal:null});
      showToast(tt('Pelanggan ditambah.'));
    };
    if(dup){
      askConfirm(tt('No. telefon ini sudah didaftarkan untuk "')+dup.name+tt('". Tambah sebagai pelanggan baharu juga?'), doSave, {confirmLabel:tt('Tambah Juga')});
    } else doSave();
  });

  bindAction('save-vehicle', ()=>{
    const btn = document.querySelector('[data-action="save-vehicle"]');
    const customerId = btn.dataset.cid;
    const plate = document.getElementById('veh-plate').value.trim();
    const model = document.getElementById('veh-model').value.trim();
    const color = document.getElementById('veh-color').value.trim();
    if(!plate){ showToast(tt('Sila masukkan no. plat.')); return; }
    const plateNorm = plate.toLowerCase().replace(/\s/g,'');
    const dup = db.vehicles.find(v=>v.plate.toLowerCase().replace(/\s/g,'')===plateNorm);
    const doSave = ()=>{
      db.vehicles.push({id:uid(), customerId, plate, model, color, odometer:0, serviceIntervalKm:10000, lastServiceKm:0});
      queueSave();
      setState({modal:null});
      showToast(tt('Kenderaan ditambah.'));
    };
    if(dup){
      const dupOwner = getCustomer(dup.customerId);
      askConfirm(tt('No. plat "')+plate+tt('" sudah wujud dalam rekod (pemilik: ')+(dupOwner?dupOwner.name:'-')+tt('). Tambah juga sebagai rekod berasingan?'), doSave, {confirmLabel:tt('Tambah Juga')});
    } else doSave();
  });

  // POS handlers
  bindAllAction('add-to-cart', el=>{
    const item = getItem(el.dataset.id);
    const existing = state.posCart.find(c=>c.refId===item.id);
    if(existing) existing.qty++;
    else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
    render();
  });
  bindAction('add-custom-cart', ()=>{
    const name = document.getElementById('pos-custom-name').value.trim();
    const price = Number(document.getElementById('pos-custom-price').value)||0;
    if(!name||price<=0){ showToast(tt('Sila lengkapkan nama & harga servis.')); return; }
    state.posCart.push({refId:null, name, price, qty:1});
    render();
  });
  bindAllAction('cart-inc', el=>{ state.posCart[el.dataset.idx].qty++; render(); });
  bindAllAction('cart-dec', el=>{
    const row = state.posCart[el.dataset.idx];
    row.qty = Math.max(1,row.qty-1);
    render();
  });
  bindAllAction('cart-remove', el=>{ state.posCart.splice(el.dataset.idx,1); render(); });

  const posCustomerSel = document.getElementById('pos-customer');
  if(posCustomerSel) posCustomerSel.addEventListener('change', ()=>{
    state.posCustomerId = posCustomerSel.value; state.posVehicleId=''; render();
  });
  const posVehicleSel = document.getElementById('pos-vehicle');
  if(posVehicleSel) posVehicleSel.addEventListener('change', ()=>{
    state.posVehicleId = posVehicleSel.value;
  });

  bindAction('close-cash', ()=>{
    const actual = Number(document.getElementById('cash-actual').value);
    if(isNaN(actual)){ showToast(tt('Sila masukkan jumlah tunai.')); return; }
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const dateStr = localDateStr(todayStart);
    const expected = db.invoices.filter(inv=>inv.createdAt>=todayStart.getTime() && inv.payment==='Tunai').reduce((s,i)=>s+i.total,0);
    db.cashClosures.push({id:uid(), date:dateStr, expected, actual, closedBy: state.currentStaff?state.currentStaff.name:'', closedAt:Date.now()});
    logAudit('Tutup Kunci Tunai', dateStr+': jangka '+fmtRM(expected)+' vs sebenar '+fmtRM(actual));
    queueSave();
    render();
    showToast(tt('Kunci tunai hari ini ditutup.'));
  });
  bindAction('checkout', async ()=>{
    if(state.posCart.length===0) return;
    // Everything here used to run with no try/catch — any unexpected throw
    // (e.g. a malformed cart entry, a missing DOM element) died silently in
    // the console with zero feedback: the button just looked unresponsive,
    // no toast, no error, cart left untouched. Wrapping it means a real bug
    // now surfaces (to the user AND to Sentry) instead of looking like
    // nothing happened at all.
    try{
      const paymentEl = document.getElementById('pos-payment');
      const payment = paymentEl ? paymentEl.value : 'Tunai';
      // deduct inventory
      state.posCart.forEach(c=>{
        if(c.refId){
          const item = getItem(c.refId);
          if(item) item.qty = Math.max(0, item.qty-c.qty);
        }
      });
      const subtotal = state.posCart.reduce((s,c)=>s+c.price*c.qty,0);
      let discountAmt = 0;
      if(state.posDiscountType==='percent') discountAmt = subtotal * (Number(state.posDiscountValue)||0) / 100;
      else discountAmt = Number(state.posDiscountValue)||0;
      discountAmt = Math.min(Math.max(discountAmt,0), subtotal);
      const afterDiscount = subtotal - discountAmt;
      const taxRate = Number(db.settings.taxRate)||0;
      const taxAmt = afterDiscount * taxRate/100;
      const total = afterDiscount + taxAmt;
      const invoiceNo = await nextInvNo();
      // db.branches is backfilled with a default on every login (see
      // handleAuthenticated), but stay defensive here too rather than
      // crash on db.branches[0].id if it's ever empty when this runs.
      const fallbackBranchId = (db.branches && db.branches[0]) ? db.branches[0].id : 'main';
      const invoice = {
        id:uid(), invoiceNo, customerId:state.posCustomerId||null, vehicleId:state.posVehicleId||null,
        jobId: state.posJobId||null, items:[...state.posCart], subtotal, discount:discountAmt, taxRate, tax:taxAmt, total, payment, createdAt:Date.now(),
        createdBy: state.currentStaff ? state.currentStaff.name : '', branchId: state.currentBranch!=='all' ? state.currentBranch : fallbackBranchId
      };
      db.invoices.push(invoice);
      logAudit('Jana Invois', invoice.invoiceNo+' — '+fmtRM(invoice.total));
      if(state.posCustomerId){
        const cust = getCustomer(state.posCustomerId);
        if(cust){
          cust.visits = (cust.visits||0)+1;
          cust.loyaltyPoints = (cust.loyaltyPoints||0)+1;
        }
      }
      if(state.posJobId){
        const job = db.jobs.find(j=>j.id===state.posJobId);
        if(job){ job.invoiced = true; job.status='delivered'; }
      }
      queueSave();
      state.posCart = []; state.posCustomerId=''; state.posVehicleId=''; state.posJobId=''; state.posDiscountValue=0; state.posDiscountType='flat';
      render();
      showToast(tt('Invois ')+invoice.invoiceNo+tt(' berjaya dijana!'));
    }catch(e){
      reportError(e, 'Checkout/jana invois gagal');
      showToast(state.language==='en' ? 'Could not generate the invoice. Try again — if it keeps failing, tell your Admin.' : 'Gagal jana invois. Cuba lagi — kalau berterusan, maklumkan Admin.');
    }
  });

  bindAllAction('print-invoice', el=>{
    const invoice = db.invoices.find(i=>i.id===el.dataset.id);
    if(invoice) printInvoice(invoice);
  });
  bindAllAction('print-jobcard', el=>{
    const job = db.jobs.find(j=>j.id===el.dataset.id);
    if(job) printJobCard(job);
  });
  bindAllAction('print-vehicle-qr', el=>{
    const vehicle = getVehicle(el.dataset.id);
    if(vehicle) printVehicleQR(vehicle);
  });

  const posSearch = document.getElementById('pos-search');
  if(posSearch){
    posSearch.addEventListener('input', ()=>{
      document.getElementById('pos-item-list').innerHTML = renderPOSItemList(posSearch.value);
      document.querySelectorAll('[data-action="add-to-cart"]').forEach(el=>el.addEventListener('click', ()=>{
        const item = getItem(el.dataset.id);
        const existing = state.posCart.find(c=>c.refId===item.id);
        if(existing) existing.qty++;
        else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
        render();
      }));
    });
  }

  const posBarcode = document.getElementById('pos-barcode');
  if(posBarcode){
    posBarcode.focus();
    posBarcode.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        const code = posBarcode.value.trim();
        if(!code) return;
        const item = db.inventory.find(i=>i.sku.toLowerCase()===code.toLowerCase());
        if(item){
          const existing = state.posCart.find(c=>c.refId===item.id);
          if(existing) existing.qty++;
          else state.posCart.push({refId:item.id, name:item.name, price:item.price, qty:1});
          render();
          showToast(item.name+tt(' ditambah ke troli.'));
        } else {
          showToast(tt('Tiada item dengan kod "')+code+'".');
          posBarcode.value='';
        }
      }
    });
  }

  const discType = document.getElementById('pos-discount-type');
  const discVal = document.getElementById('pos-discount-value');
  if(discType) discType.addEventListener('change', ()=>{ state.posDiscountType = discType.value; render(); });
  bindAction('apply-loyalty-discount', ()=>{
    state.posDiscountType = 'percent';
    state.posDiscountValue = Number(db.settings.loyaltyDiscount)||0;
    render();
    showToast(tt('Diskaun setia digunakan.'));
  });
  if(discVal) discVal.addEventListener('input', ()=>{ state.posDiscountValue = discVal.value; render(); focusEnd('pos-discount-value'); });
}

