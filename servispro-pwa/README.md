# ServisPro — Pek Self-Hosting untuk PWA Sebenar

Folder ini mengandungi semua fail yang anda perlukan untuk jadikan ServisPro
sebagai **Progressive Web App (PWA) sebenar** — boleh dipasang ("Add to Home
Screen") dengan ikon sendiri di telefon/komputer, dan berfungsi luar talian
selepas dibuka sekali.

Ini **tidak akan berfungsi** di dalam artifact Claude.ai (sebab ia perlukan
domain/hosting sebenar) — anda perlu letak fail ini di suatu tempat di
internet dahulu. Panduan penuh di bawah.

## Kandungan Folder

```
servispro-pwa/
├── ServisPro.html          ← Sistem ServisPro penuh (buka fail ini di browser)
├── manifest.json        ← Metadata PWA (nama, ikon, warna tema)
├── service-worker.js    ← Membolehkan app dibuka luar talian
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
└── README.md            ← Fail ini
```

## PENTING: Perubahan Storan Data

Versi asal ServisPro (dalam Claude.ai) guna `window.storage`, iaitu ciri
khas artifact Claude.ai untuk simpan data. Fail `ServisPro.html` dalam folder
ini **sudah termasuk polyfill automatik** — jika `window.storage` tiada
(iaitu bila dibuka di luar Claude.ai), ia akan guna `localStorage` pelayar
sebagai gantinya secara automatik. Anda tidak perlu ubah apa-apa kod untuk
ini berfungsi asas.

**Tapi ambil perhatian had penting:**
- `localStorage` hanya disimpan **pada peranti/browser itu sahaja**. Jika
  staf lain buka ServisPro di telefon mereka sendiri, mereka akan nampak
  data KOSONG (bukan data yang sama) — tiada perkongsian data merentasi
  peranti.
- Ini sesuai untuk **cubaan/demo peribadi** atau bengkel yang hanya guna
  SATU peranti/komputer sahaja untuk seluruh operasi.
- Untuk bengkel yang perlukan beberapa staf log masuk dari peranti
  berlainan dan lihat data yang sama secara masa nyata, anda memerlukan
  **backend/pangkalan data sebenar** (lihat bahagian "Langkah Seterusnya"
  di bawah).

## Cara Hosting (Pilih Satu)

**PENTING — Nota Nama Fail:** Fail utama dinamakan `ServisPro.html`
(bukan `index.html`). Kebanyakan pelayan web (Netlify, GitHub Pages, dll.)
secara automatik memuatkan fail bernama `index.html` bila pelawat lawati URL
utama (cth: `https://tapak-anda.com/`). Oleh kerana fail ini dinamakan
berbeza, pelawat **perlu taip nama fail penuh dalam URL**, contohnya:
```
https://tapak-anda.com/ServisPro.html
```
(ruang dalam nama fail digantikan `%20` dalam URL — ini biasa berlaku
automatik apabila pelayar buka fail tersebut).

Jika anda mahu pelawat terus sampai ke sistem tanpa taip nama fail panjang,
ada dua pilihan:
1. **Namakan semula fail kepada `index.html`** semasa muat naik ke hosting
   (paling mudah)
2. **Tambah fail `index.html` kecil** yang terus alih (redirect) ke fail
   `ServisPro.html` — beritahu saya jika anda mahu saya sediakan
   fail redirect ini

### Pilihan 1: GitHub Pages (Disyorkan, Percuma)
1. Cipta repositori baharu di GitHub, muat naik semua fail dalam folder ini
2. Pergi ke **Settings → Pages**, pilih branch `main`, folder `/ (root)`
3. GitHub akan beri URL (contoh: `https://namaanda.github.io/servispro`)

### Pilihan 2: Netlify Drop (Paling Pantas untuk Uji, Percuma)
1. Pergi ke [app.netlify.com/drop](https://app.netlify.com/drop)
2. Seret keseluruhan folder `servispro-pwa` ke laman tersebut
3. Netlify akan beri anda URL (contoh: `https://servispro-auto.netlify.app`)
4. Buka URL itu di telefon → nampak opsyen "Add to Home Screen" / "Install App"

### Pilihan 3: Vercel
1. Pergi ke [vercel.com](https://vercel.com), daftar percuma
2. Muat naik folder ini sebagai projek baharu (tiada build command diperlukan)
3. Vercel beri URL automatik

### Pilihan 4: Pelayan Web Sendiri
Jika bengkel anda ada pelayan/hosting sendiri (cPanel, VPS, dll.), muat naik
kandungan folder ini terus ke `public_html` atau root web anda melalui FTP.

**Nota Wajib:** PWA (manifest + service worker) **memerlukan HTTPS**.
Semua pilihan di atas (Netlify, GitHub Pages, Vercel) automatik sediakan
HTTPS percuma. Jika guna pelayan sendiri, pastikan ada sijil SSL/HTTPS.

## Cara "Install" di Telefon/Komputer

Selepas dihoskan dengan HTTPS:

**Android (Chrome):** Buka URL → menu (⋮) → "Add to Home screen" / "Install app"

**iPhone (Safari):** Buka URL → butang Share (□↑) → "Add to Home Screen"

**Desktop (Chrome/Edge):** Buka URL → ikon install (⊕) di address bar →
"Install"

Selepas dipasang, ServisPro akan muncul sebagai ikon aplikasi berasingan
(bukan tab browser), dengan skrin splash dan ikon sendiri.

## Langkah Seterusnya (Jika Bengkel Berkembang)

Jika bengkel anda perlukan berbilang staf/peranti berkongsi data yang sama
secara masa nyata, `localStorage` tidak lagi mencukupi. Langkah seterusnya
ialah membina backend sebenar — contohnya:
- Pangkalan data seperti Supabase, Firebase, atau PostgreSQL
- API ringkas (Node.js/Express, atau serupa) untuk baca/tulis data
- Sistem log masuk sebenar dengan token/sesi selamat (bukan sekadar PIN
  tempatan)

Ini adalah projek pembangunan tersendiri di luar skop pek self-hosting ini.
Alat seperti Claude Code sesuai untuk membantu membina backend tersebut
apabila anda bersedia untuk fasa itu.

## Soalan Lazim

**S: Bolehkah saya terus guna fail `ServisPro.html` ini tanpa hosting (buka
terus dari komputer)?**
J: Boleh, buka terus dengan double-click. Ia akan berfungsi sepenuhnya
(dengan localStorage), tetapi ciri "install sebagai app" (PWA) tidak akan
tersedia kerana itu memerlukan HTTPS. Anda hanya dapat guna ia sebagai
laman web biasa dalam tab browser.

**S: Data saya hilang selepas saya kemas kini/tukar fail `ServisPro.html`?**
J: Tidak — data disimpan dalam `localStorage` browser anda, berasingan
daripada fail. Menukar fail `ServisPro.html` (contohnya untuk kemas kini
sistem) tidak akan memadam data sedia ada, selagi anda buka dari domain/
URL yang sama.

**S: Bolehkah saya tukar ikon aplikasi?**
J: Boleh — gantikan fail dalam folder `icons/` dengan saiz yang sama
(192×192 dan 512×512 piksel), kekalkan nama fail yang sama.
