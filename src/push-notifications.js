/* ============================= PUSH NOTIFICATIONS =============================
   Real Web Push for support chat replies (see src/support-chat.js) -- works
   even if the app/browser is fully closed, unlike a plain in-app badge.
   This file only handles the SUBSCRIBE side: asking the browser for
   permission, registering with the browser's push service, and syncing
   that subscription (just an endpoint URL + two public keys, nothing
   secret) into this shop's own database like any other record via
   TABLE_MAP's push_subscriptions entry.

   The SEND side lives entirely server-side: a trigger on support_messages
   calls a Supabase Edge Function (see backend/schema.sql's
   notify_new_support_message and supabase/functions/notify-support-message/)
   which looks up the recipient's subscriptions and sends the actual push.
   Nothing in this file sends anything -- it only subscribes/unsubscribes
   this device. The service worker's own `push`/`notificationclick`
   handlers (see src/service-worker.js) are what actually display the
   notification when one arrives.
*/
// Public VAPID key -- safe to embed client-side by design (it's how the
// browser's push service verifies pushes came from whoever holds the
// matching PRIVATE key, which only lives server-side as an Edge Function
// secret, never here). Generated once via `npx web-push generate-vapid-keys`.
const PUSH_VAPID_PUBLIC_KEY = 'BOtHlLDxMyIJiArZ1tBKRRdnuimwIWjhllFi4pvhD2h1k2lryJDLZjYUNvqAYNRNZKAPa1-tTE3bw5yIRGQDgjQ';

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function pushSupported(){
  return typeof navigator!=='undefined' && 'serviceWorker' in navigator && typeof window!=='undefined' && 'PushManager' in window;
}

// True if THIS device/browser already has an active push subscription --
// checked against the browser's own registration, not just local
// bookkeeping, so a permission revoked from browser settings (outside the
// app) is reflected correctly instead of showing a stale "on" toggle.
async function isPushSubscribed(){
  if(!pushSupported()) return false;
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }catch(e){ return false; }
}

// Populates state.pushSubscribed so the Account page toggle (see
// views/account.js) can render synchronously instead of every render()
// call needing to await a browser API. Called once on login (see
// handleAuthenticated in sync-engine.js) -- fire-and-forget, same reasoning
// as checkLicenseStatus() there.
async function refreshPushSubscriptionState(){
  const subscribed = await isPushSubscribed();
  if(state.pushSubscribed !== subscribed){
    state.pushSubscribed = subscribed;
    render();
  }
}

async function subscribeToPush(){
  const en = state.language==='en';
  if(!pushSupported()){
    showToast(en ? 'Push notifications aren\'t supported on this browser/device.' : 'Notifikasi push tidak disokong pada pelayar/peranti ini.');
    return false;
  }
  try{
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){
      showToast(en ? 'Notification permission denied.' : 'Kebenaran notifikasi ditolak.');
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY),
      });
    }
    const staffId = state.currentStaff ? state.currentStaff.id : null;
    if(!staffId) return false;
    const json = sub.toJSON();
    // One row per (staffId, endpoint) -- replace any existing row for this
    // exact endpoint (re-subscribing on the same device/browser profile)
    // rather than piling up duplicates every time this runs.
    db.pushSubscriptions = (db.pushSubscriptions||[]).filter(p => !p.subscription || p.subscription.endpoint !== json.endpoint);
    db.pushSubscriptions.push({ id:uid(), staffId, subscription:json, createdAt:Date.now() });
    queueSave();
    showToast(en ? 'Push notifications enabled.' : 'Notifikasi push diaktifkan.');
    return true;
  }catch(e){
    reportError(e, 'Gagal aktifkan notifikasi push');
    showToast(en ? 'Could not enable push notifications.' : 'Gagal aktifkan notifikasi push.');
    return false;
  }
}

async function unsubscribeFromPush(){
  const en = state.language==='en';
  try{
    if(!pushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      db.pushSubscriptions = (db.pushSubscriptions||[]).filter(p => !p.subscription || p.subscription.endpoint !== endpoint);
      queueSave();
    }
    showToast(en ? 'Push notifications turned off.' : 'Notifikasi push dimatikan.');
    return true;
  }catch(e){
    reportError(e, 'Gagal matikan notifikasi push');
    return false;
  }
}
