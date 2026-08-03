# ServisPro — Semua Fail Projek

Folder ini mengandungi **kesemua kod** sistem ServisPro (Perisian Pengurusan
Bengkel / Automotif POS) yang telah dibina.

## Struktur Folder

```
Mr 4x4 Auto Service/
├── src/                       ← KOD SUMBER — edit fail di sini, BUKAN fail HTML terus
│   ├── views/                 ← satu fail bagi setiap skrin (dashboard, pos, jobs, dll.)
│   ├── sync-engine.js         ← logik sync Supabase + log masuk + sandaran automatik
│   ├── event-handlers.js      ← semua butang/borang (data-action bindings)
│   ├── service-worker.js      ← sokongan luar talian (nombor versi cache dijana automatik)
│   ├── global.d.ts            ← bentuk data (Customer, Job, Invoice, dll.) untuk semakan jenis
│   └── ... (lihat build/build.js untuk senarai penuh & susunan)
├── build/
│   ├── build.js                ← `npm run build` cantumkan src/ semula jadi 1 fail HTML
│   └── deploy.js                ← `npm run deploy` — build + hantar ke Netlify (backup manual, tak digunakan sekarang — lihat "Git & CI")
├── backend/
│   ├── schema.sql               ← skema pangkalan data Supabase (jalankan di SQL Editor)
│   ├── SETUP.md                 ← panduan setup backend (sekali sahaja)
│   ├── SENTRY_SETUP.md          ← panduan hidupkan pengesanan ralat (pilihan)
│   └── MFA_RECOVERY.md          ← panduan pulihkan akaun staf yang terkunci 2FA
├── tests/                      ← suite ujian automatik (lihat tests/README.md)
├── android-app/                ← APK Android sedia-tanda-tangan (sideload, bukan Play Store) — lihat android-app/README.md
├── .github/workflows/           ← GitHub Actions: ci.yml (typecheck+build+ujian setiap push),
│                                   uptime-check.yml (jaga laman live), test-project-keepalive.yml
├── tsconfig.json                ← `npm run typecheck` — semakan jenis (TypeScript/JSDoc)
├── package.json                  ← `npm install` dahulu, kemudian npm run build / test / check / deploy
├── LICENSE                       ← lesen kod sumber
└── Mr 4x4 Auto Service-pwa/         ← OUTPUT — fail yang sebenarnya di-deploy (jangan edit terus)
    ├── Mr 4x4 Auto Service.html ← DIHASILKAN oleh `npm run build`, bukan fail sumber
    ├── manifest.json      ← Metadata PWA (nama, ikon, warna tema)
    ├── service-worker.js  ← DIHASILKAN oleh `npm run build`, bukan fail sumber
    ├── icons/             ← Ikon aplikasi
    └── README.md          ← Panduan hosting terperinci
```

## Cara Bangunkan (Development)

Sejak sistem sync merentasi peranti dibina, kod sumber sebenar disimpan
dalam `src/` (bukan terus dalam fail HTML). Untuk buat sebarang perubahan:

```
npm install               # sekali sahaja
npm run typecheck         # semak jenis data (tangkap silap sebelum jalan)
npm run build              # cantumkan src/ jadi Mr 4x4 Auto Service-pwa/Mr 4x4 Auto Service.html
npm test                   # jalankan suite ujian automatik (perlukan sambungan internet)
npm run check               # buat kesemua 3 di atas sekali gus
npm run deploy               # backup manual ke Netlify (perlukan .env dengan NETLIFY_AUTH_TOKEN) — tak digunakan sekarang, lihat "Git & CI"
```

**Jangan edit `Mr 4x4 Auto Service-pwa/Mr 4x4 Auto Service.html` atau
`Mr 4x4 Auto Service-pwa/service-worker.js` terus** — kedua-duanya akan
ditimpa semula pada `npm run build` yang seterusnya. Edit fail dalam
`src/` sebaliknya.

## Git & CI

Kod ini disimpan di GitHub (`tomassual-hub/servispro`, **repo
awam** — diperlukan untuk GitHub Pages percuma; tiada rahsia/kunci
dalam kod, semua dalam `.env` yang tak pernah masuk Git). Setiap
`git push` ke `master` men-trigger GitHub Actions
(`.github/workflows/ci.yml`) yang:
1. Jalankan typecheck + build + suite ujian penuh secara automatik
   terhadap **projek Supabase berasingan sepenuhnya** khas untuk ujian
   (lihat `tests/README.md`) — bukan sekadar akaun pakai buang dalam
   pangkalan data sama, tapi pangkalan data yang lain sama sekali
   daripada data kedai sebenar.
2. Kalau semua ujian lulus, **deploy automatik ke GitHub Pages** —
   laman live: **https://tomassual-hub.github.io/servispro/**

**Netlify** (`netlify.toml`, `npm run deploy`) adalah persediaan lama —
dibiarkan terpasang sebagai pilihan sandaran (kalau kredit had percuma
reset atau nak tambah bayaran), tapi **tidak digunakan sekarang**.
Laman GitHub Pages di atas ialah yang sebenarnya live.

## Ciri-Ciri Utama Sistem

- **Kad Kerja** — tiket kerja servis bergaya bengkel sebenar, dengan status,
  nota dalaman, tandatangan digital, gambar sebelum/selepas, senarai semak
  pemeriksaan dengan diagram kerosakan boleh ditanda, tugaskan ke Bay/lif
  fizikal (pilihan), dan Kad Kerja Pemulangan untuk kes waranti
- **POS/Invois** — troli jualan (termasuk Pakej harga istimewa), diskaun,
  SST, bayaran berbilang/sebahagian dalam satu invois, Sebut Harga (boleh
  ditukar jadi invois kemudian), Nota Kredit, cetak invois/kad kerja, kod
  bar/kod pantas
- **Inventori** — stok alat ganti, pembekal, pesanan belian (manual & auto,
  termasuk terima penghantaran sebahagian), cadangan pesanan semula ikut
  pembekal, import CSV pukal
- **Pelanggan & Kenderaan** — sejarah servis penuh, waranti alat ganti,
  amaran servis ikut kilometer (dipaparkan juga di Papan Pemuka dengan
  butang peringatan WhatsApp sekali klik), kod QR kenderaan, prospek/leads
  (CRM) sebelum jadi pelanggan sebenar
- **Tempahan & Kontrak Servis** — janji temu (dengan kalendar bulanan
  berpusat), invois berulang untuk pelanggan korporat
- **Rujukan Teknikal** — perpustakaan nota bengkel sendiri ikut jenama/model
  kenderaan (jadual servis, jenis minyak, spesifikasi tork, lokasi
  komponen, gambar rajah/kod kerosakan, dll.) dengan lampiran gambar —
  diisi oleh staf sendiri, bukan data pra-dimuat
- **Kehadiran QR & Layan Diri Pelanggan** — kod QR peribadi staf untuk
  clock in/out tanpa log masuk; ringkasan kehadiran bulanan per-staf
  (hadir/tidak hadir/jam bekerja + senarai harian, di Staf); pautan laporan
  pemeriksaan kenderaan yang boleh dikongsi & ditandatangan pelanggan dari
  telefon sendiri; Papan Paparan kawasan menunggu (status kerja masa nyata,
  tanpa log masuk)
- **Papan Pemuka** — masthead ServisPro (ruang kerja = nama kedai anda),
  panel Aliran Kerja Bengkel (pautan pantas ikut aliran kerja sebenar:
  pelanggan → kad kerja → invois → sejarah), carta trend jualan 30 hari,
  amaran servis ikut kilometer dengan butang peringatan WhatsApp sekali
  klik
- **Laporan & Sasaran** — untung/rugi (P&L), pecahan untung alat ganti vs
  servis, prestasi & komisen mekanik, ramalan stok, analitik pusing ganti
  inventori, analitik pelanggan senyap, carta jualan, sasaran jualan/unit
  bulanan dengan progres di Papan Pemuka
- **Staf** — log masuk e-mel/kata laluan sebenar, kebenaran ikut peranan
  (Admin / Kerani / Ketua Mekanik / Mekanik) dengan sekatan Admin terakhir
  tak boleh dipadam/diturun pangkat, log aktiviti (audit trail)
- **Loceng Notifikasi**, **Mod Kiosk** (semak status tanpa log masuk),
  **Sokongan Berbilang Cawangan**
- **Dwibahasa** — suis Bahasa Melayu ⇄ English (MS/EN)
- **Tema Terang/Gelap**, **Mod Ringkas/Lanjutan** (sorok ciri lanjutan
  untuk paparan harian lebih ringkas), **Tutorial Onboarding**, **Tab
  navigasi bawah untuk mobile**
- **Sandaran & Pemulihan Data** — muat turun manual, ATAU automatik ke
  pelayan (setiap 7 hari bila Admin log masuk, boleh muat turun balik di
  Tetapan), eksport CSV & format perakaunan
- **Pengesanan Ralat** (Sentry, pilihan) dan **prom kemas kini automatik**
  bila versi baharu di-deploy

## Ikon Aplikasi

Ikon aplikasi (`Mr 4x4 Auto Service-pwa/icons/`) menggunakan logo rasmi Mr 4x4 Auto Service
(dijana sendiri oleh pemilik perniagaan menggunakan alat pembuat logo).

- `icon-512.png`, `icon-192.png`, `apple-touch-icon.png` — lambang sahaja (gear + penumbuk + "M"), untuk ikon app
- `logo-full-lockup.png` — versi penuh (lambang + nama syarikat), untuk README/splash screen/bahan pemasaran
- `logo-source-original.png` — fail asal yang dimuat naik (rujukan/sandaran)

**Nota kualiti:** Fail sumber asal bersaiz kecil (200×200px, biasa untuk muat turun percuma
alat logo maker). Jika perniagaan berkembang dan perlukan bahan cetak/pemasaran
beresolusi tinggi, disyorkan muat turun versi vektor/resolusi tinggi daripada
alat logo maker yang digunakan (biasanya tersedia dengan bayaran kecil).

## Log Masuk

Log masuk dengan **e-mel + kata laluan sebenar** (Supabase Auth), bukan
PIN — setiap staf ada akaun sendiri, ditambah oleh Admin di Tetapan →
Staf. Lihat `backend/SETUP.md` untuk sediakan backend, dan
`backend/SENTRY_SETUP.md` untuk hidupkan pengesanan ralat (pilihan).

## Nota Penting

- Sistem ini **berkongsi data merentasi semua peranti secara masa nyata**
  (dikuasakan oleh Supabase) — staf boleh log masuk dari telefon/komputer
  berlainan dan lihat data yang sama serentak.
- Suite ujian automatik (`tests/`) menguji terus terhadap backend Supabase
  sebenar menggunakan akaun ujian pakai buang — JANGAN tuju ke akaun
  bengkel sebenar.
