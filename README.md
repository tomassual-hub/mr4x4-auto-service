# Mr 4x4 Auto Service — Semua Fail Projek

Folder ini mengandungi **kesemua kod** sistem Mr 4x4 Auto Service (Perisian Pengurusan
Bengkel / Automotif POS) yang telah dibina.

## Struktur Folder

```
Mr 4x4 Auto Service-Lengkap/
├── Mr 4x4 Auto Service.html   ← Versi UNTUK CLAUDE.AI (guna dalam artifact/chat, tak disentuh sejak backend dibina)
├── src/                       ← KOD SUMBER — edit fail di sini, BUKAN fail HTML terus
│   ├── views/                 ← satu fail bagi setiap skrin (dashboard, pos, jobs, dll.)
│   ├── sync-engine.js         ← logik sync Supabase + log masuk
│   ├── event-handlers.js      ← semua butang/borang (data-action bindings)
│   ├── global.d.ts            ← bentuk data (Customer, Job, Invoice, dll.) untuk semakan jenis
│   └── ... (lihat build/build.js untuk senarai penuh & susunan)
├── build/
│   └── build.js                ← `npm run build` cantumkan src/ semula jadi 1 fail HTML
├── tests/                      ← suite ujian automatik (lihat tests/README.md)
├── tsconfig.json                ← `npm run typecheck` — semakan jenis (TypeScript/JSDoc)
├── package.json                  ← `npm install` dahulu, kemudian npm run build / test / check
└── Mr 4x4 Auto Service-pwa/         ← OUTPUT — fail yang sebenarnya di-deploy (jangan edit terus)
    ├── Mr 4x4 Auto Service.html ← DIHASILKAN oleh `npm run build`, bukan fail sumber
    ├── manifest.json      ← Metadata PWA (nama, ikon, warna tema)
    ├── service-worker.js  ← Sokongan luar talian
    ├── icons/             ← Ikon aplikasi
    └── README.md          ← Panduan hosting terperinci
```

## Cara Bangunkan (Development)

Sejak sistem sync merentasi peranti dibina, kod sumber sebenar disimpan
dalam `src/` (bukan terus dalam fail HTML). Untuk buat sebarang perubahan:

```
npm install              # sekali sahaja
npm run typecheck        # semak jenis data (tangkap silap sebelum jalan)
npm run build             # cantumkan src/ jadi Mr 4x4 Auto Service-pwa/Mr 4x4 Auto Service.html
npm test                  # jalankan suite ujian automatik (perlukan sambungan internet)
npm run check              # buat kesemua 3 di atas sekali gus
```

Selepas `npm run build`, deploy folder `Mr 4x4 Auto Service-pwa/` seperti
biasa (Netlify, dll.) — fail HTML di dalamnya itulah yang dihantar ke
pelayar staf.

**Jangan edit `Mr 4x4 Auto Service-pwa/Mr 4x4 Auto Service.html` terus** —
ia akan ditimpa semula pada `npm run build` yang seterusnya. Edit fail
dalam `src/` sebaliknya.

## Fail Mana Nak Guna?

**Guna `Mr 4x4 Auto Service.html`** jika anda mahu terus guna sistem ini di dalam
Claude.ai (upload semula sebagai fail, atau minta Claude buka sebagai
artifact). Data disimpan menggunakan `window.storage` (ciri Claude.ai).

**Guna folder `Mr 4x4 Auto Service-pwa/`** jika anda mahu:
- Host sistem ini di internet sendiri (Netlify, GitHub Pages, dll.)
- Install sebagai app di telefon/komputer dengan ikon sendiri
- Sistem berfungsi walaupun tiada sambungan internet (selepas dibuka sekali)

Kedua-dua versi mengandungi **fungsi yang sama** — bezanya hanya cara data
disimpan (`window.storage` vs `localStorage`) dan sokongan tambahan untuk
PWA. Lihat `Mr 4x4 Auto Service-pwa/README.md` untuk panduan hosting penuh.

## Ciri-Ciri Utama Sistem

- **Kad Kerja** — tiket kerja servis bergaya bengkel sebenar, dengan status,
  nota dalaman, tandatangan digital, gambar sebelum/selepas, senarai semak
  pemeriksaan
- **POS/Invois** — troli jualan, diskaun, SST, cetak invois/kad kerja, kod
  bar/kod pantas
- **Inventori** — stok alat ganti, pembekal, pesanan belian (manual & auto)
- **Pelanggan & Kenderaan** — sejarah servis penuh, waranti alat ganti,
  amaran servis ikut kilometer, kod QR kenderaan
- **Tempahan & Kontrak Servis** — janji temu, invois berulang untuk
  pelanggan korporat
- **Laporan** — untung/rugi (P&L), prestasi & komisen mekanik, ramalan
  stok, analitik pelanggan senyap, carta jualan
- **Staf** — log masuk PIN dengan kunci selepas percubaan gagal, kebenaran
  ikut peranan (Admin/Mekanik), log aktiviti (audit trail)
- **Loceng Notifikasi**, **Mod Kiosk** (semak status tanpa log masuk),
  **Sokongan Berbilang Cawangan**
- **Dwibahasa** — suis Bahasa Melayu ⇄ English (MS/EN)
- **Tema Terang/Gelap**, **Mod Ringkas/Lanjutan**, **Tutorial Onboarding**
- **Sandaran & Pemulihan Data**, eksport CSV & format perakaunan

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

Versi `Mr 4x4 Auto Service-pwa/` (yang sebenarnya digunakan) log masuk
dengan **e-mel + kata laluan sebenar** (Supabase Auth), bukan PIN — setiap
staf ada akaun sendiri, ditambah oleh Admin di Tetapan → Staf. Lihat
`backend/SETUP.md` untuk sediakan backend, dan `backend/SENTRY_SETUP.md`
untuk hidupkan pengesanan ralat (pilihan).

Versi `Mr 4x4 Auto Service.html` (untuk Claude.ai) yang guna PIN/data
tempatan sahaja tidak lagi diselenggara sejak backend dibina — ia
ditinggalkan sengaja sebagai rujukan sejarah, bukan untuk kegunaan sebenar.

## Nota Penting

- Versi `Mr 4x4 Auto Service-pwa/` **berkongsi data merentasi semua
  peranti secara masa nyata** (dikuasakan oleh Supabase) — staf boleh log
  masuk dari telefon/komputer berlainan dan lihat data yang sama serentak.
- Suite ujian automatik (`tests/`) menguji terus terhadap backend Supabase
  sebenar menggunakan akaun ujian pakai buang — JANGAN tuju ke akaun
  bengkel sebenar.
