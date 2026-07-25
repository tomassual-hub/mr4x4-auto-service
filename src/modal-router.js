/* ============================= MODAL ROUTER ============================= */
function renderModal(){
  let inner = '';
  const m = state.modal;
  if(m.type==='new-job') inner = newJobModalHTML();
  else if(m.type==='job-detail') inner = jobDetailModalHTML(m.job);
  else if(m.type==='new-item') inner = itemModalHTML(null);
  else if(m.type==='edit-item') inner = itemModalHTML(m.item);
  else if(m.type==='new-customer') inner = customerModalHTML();
  else if(m.type==='new-vehicle') inner = vehicleModalHTML(m.customerId);
  else if(m.type==='new-staff') inner = staffModalHTML(null);
  else if(m.type==='edit-staff') inner = staffModalHTML(m.staffMember);
  else if(m.type==='edit-customer') inner = customerEditModalHTML(m.customer);
  else if(m.type==='edit-vehicle') inner = vehicleEditModalHTML(m.vehicle);
  else if(m.type==='vehicle-history') inner = vehicleHistoryModalHTML(m.vehicle);
  else if(m.type==='new-appointment') inner = appointmentModalHTML();
  else if(m.type==='new-contract') inner = contractModalHTML();
  else if(m.type==='new-supplier') inner = supplierModalHTML();
  else if(m.type==='new-po') inner = poModalHTML();
  else if(m.type==='inspection') inner = inspectionModalHTML(m.job);
  return `<div class="modal-overlay" data-action="overlay-close"><div class="modal" onclick="event.stopPropagation()">${inner}</div></div>`;
}

