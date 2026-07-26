# 2FA — Cara Pulihkan Staf yang Terkunci

Setiap staf boleh sediakan 2FA sendiri (ikon 🛡️ di sebelah butang log
keluar). Selepas diaktifkan, mereka **perlu** kod dari aplikasi
authenticator (Google Authenticator, Authy, dll.) setiap kali log masuk —
bukan pilihan sekali sahaja.

## Jika staf hilang/tukar telefon dan tak boleh log masuk

Mereka tak boleh buang 2FA sendiri (perlu log masuk dahulu untuk buat
itu — itulah puncanya). Hanya **Admin dengan akses Supabase Dashboard**
boleh bantu:

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → buka
   projek kedai.
2. Sidebar kiri → **Authentication → Users**.
3. Cari staf tu (ikut e-mel) → klik untuk buka butiran.
4. Cari bahagian **Multi-Factor Authentication** / **Factors** → padam
   factor TOTP mereka.
5. Bagitahu staf tu — mereka boleh log masuk semula dengan e-mel +
   kata laluan sahaja (macam sebelum 2FA), dan sediakan semula 2FA
   (peranti baharu) bila-bila di dalam app.

**Tiada cara lain untuk pulihkan akses** — ini sengaja (itulah tujuan
2FA). Jangan kongsi akses Dashboard Supabase dengan sesiapa yang tak
patut ada akses admin penuh ke pangkalan data.

## Nota teknikal

- 2FA dikuasakan oleh Supabase Auth (TOTP, RFC 6238) — bukan sesuatu
  yang dibina/disimpan dalam pangkalan data app ini sendiri.
- Kod QR & rahsia enrolmen tidak pernah disimpan di mana-mana selain
  peranti staf sendiri semasa proses sediakan — app ini tidak simpan
  salinan.
