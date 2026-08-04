/* ============================= SUPPORT CHAT =============================
   Internal staff <-> management help channel, not a channel to this app's
   own developer -- each shop runs its own isolated Supabase project (see
   backend/SETUP.md), so there's no shared backend a from-outside "contact
   support" chat could actually reach. One thread per non-manager staff
   member (Mekanik/Ketua Mekanik); any manager (Admin/Pemilik/Kerani) can
   read and reply to any thread, same open trust tier as the rest of this
   app's data (see support_messages in backend/schema.sql) -- "management"
   answers collectively, not as separate 1:1 chats per manager.
   Synced like every other db.* array (see TABLE_MAP in sync-engine.js), so
   a reply sent from one device shows up live on another. */

function supportThreadIdForCurrentUser(){
  const s = state.currentStaff;
  if(!s) return null;
  return canManage() ? (state.supportChatThreadId || null) : s.id;
}

function supportMessagesForThread(threadStaffId){
  return (db.supportMessages||[])
    .filter(m=>m.threadStaffId===threadStaffId)
    .sort((a,b)=>a.createdAt-b.createdAt);
}

// One row per staff member who has ever sent/received a message, newest
// activity first -- the manager's "inbox" before picking a thread to open.
function supportThreadsForManager(){
  const byStaff = new Map();
  (db.supportMessages||[]).forEach(m=>{
    if(!byStaff.has(m.threadStaffId)) byStaff.set(m.threadStaffId, []);
    byStaff.get(m.threadStaffId).push(m);
  });
  const rows = [];
  byStaff.forEach((msgs, staffId)=>{
    msgs.sort((a,b)=>a.createdAt-b.createdAt);
    const last = msgs[msgs.length-1];
    const staffMember = db.staff.find(s=>s.id===staffId);
    rows.push({
      staffId,
      staffName: staffMember ? staffMember.name : last.senderSide==='staff' ? last.senderName : (state.language==='en'?'(removed staff)':'(staf dipadam)'),
      lastMessage: last.message,
      lastAt: last.createdAt,
      unreadCount: msgs.filter(m=>m.senderSide==='staff' && !m.read).length,
    });
  });
  return rows.sort((a,b)=>b.lastAt-a.lastAt);
}

// Bubble/topbar badge count -- for regular staff, unread replies in their
// own thread; for a manager, unread messages from ANY staff member's
// thread (a total across every inbox row, not a per-thread count).
function supportUnreadCount(){
  const s = state.currentStaff;
  if(!s) return 0;
  if(canManage()){
    return (db.supportMessages||[]).filter(m=>m.senderSide==='staff' && !m.read).length;
  }
  return (db.supportMessages||[]).filter(m=>m.threadStaffId===s.id && m.senderSide==='manager' && !m.read).length;
}

// Marks the OTHER side's messages in this thread as read -- called when
// opening it (see 'open-support-chat'/'open-support-thread' in
// event-handlers.js), not on every render, so this doesn't fire a save on
// every keystroke while typing a reply.
function markSupportThreadRead(threadStaffId){
  if(!threadStaffId) return;
  const mySide = canManage() ? 'manager' : 'staff';
  const otherSide = mySide==='manager' ? 'staff' : 'manager';
  let changed = false;
  (db.supportMessages||[]).forEach(m=>{
    if(m.threadStaffId===threadStaffId && m.senderSide===otherSide && !m.read){
      m.read = true;
      changed = true;
    }
  });
  if(changed){ queueSave(); render(); }
}

function renderSupportChatModal(){
  const en = state.language==='en';
  const s = state.currentStaff;
  if(canManage() && !state.supportChatThreadId){
    const threads = supportThreadsForManager();
    return `
    <div class="support-chat-head">
      <h2 style="margin:0;">${ICONS.chat} ${en?'Support':'Sokongan'}</h2>
      <button class="btn-icon" data-action="close-modal">${ICONS.x}</button>
    </div>
    <div class="support-chat-messages">
      ${threads.length===0 ? emptyState(en?'No messages yet.':'Belum ada mesej.') : threads.map(row=>`
        <div class="support-inbox-row" data-action="open-support-thread" data-id="${row.staffId}">
          <div class="user-avatar">${initials(row.staffName)}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;gap:8px;">
              <span style="font-weight:600;font-size:13.5px;">${esc(row.staffName)}</span>
              <span style="font-size:10.5px;color:var(--text-muted);flex-shrink:0;">${fmtDateTime(row.lastAt)}</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(row.lastMessage)}</div>
          </div>
          ${row.unreadCount>0 ? `<span class="notif-badge" style="position:static;">${row.unreadCount}</span>` : ''}
        </div>`).join('')}
    </div>
    `;
  }

  const threadStaffId = supportThreadIdForCurrentUser();
  const threadStaffMember = canManage() ? db.staff.find(st=>st.id===threadStaffId) : s;
  const messages = threadStaffId ? supportMessagesForThread(threadStaffId) : [];
  return `
  <div class="support-chat-head">
    ${canManage() ? `<button class="btn-icon" data-action="back-to-support-inbox">${ICONS.chevronLeft}</button>` : ''}
    <h2 style="margin:0;flex:1;">${ICONS.chat} ${canManage() ? esc(threadStaffMember?threadStaffMember.name:'') : (en?'Support':'Sokongan')}</h2>
    <button class="btn-icon" data-action="close-modal">${ICONS.x}</button>
  </div>
  <div class="support-chat-messages" id="support-chat-messages">
    ${messages.length===0 ? `<div style="text-align:center;color:var(--text-muted);font-size:12.5px;padding:30px 0;">${en?'No messages yet — send one below.':'Belum ada mesej — hantar satu di bawah.'}</div>` : messages.map(m=>`
      <div class="support-msg ${m.senderId===s.id ? 'support-msg-mine':'support-msg-theirs'}">
        <div>${esc(m.message)}</div>
        <div class="support-msg-meta">${m.senderId===s.id ? '' : esc(m.senderName)+' · '}${fmtDateTime(m.createdAt)}</div>
      </div>`).join('')}
  </div>
  <div class="support-chat-input-row">
    <input id="support-chat-input" placeholder="${en?'Type a message…':'Taip mesej…'}" autocomplete="off">
    <button class="btn btn-primary" data-action="send-support-message" data-id="${threadStaffId||''}">${ICONS.chat}</button>
  </div>
  `;
}
