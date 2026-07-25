# Menyediakan Pengesanan Ralat (Sentry)

Ciri ini beritahu anda (melalui e-mel) bila sesuatu rosak dalam app untuk
staf sebenar — tanpa ini, ralat hanya muncul dalam DevTools browser staf
tersebut, yang anda takkan nampak.

Ia **dimatikan secara automatik** sehingga anda ikut langkah di bawah — app
berfungsi seperti biasa tanpanya.

## 1. Daftar akaun percuma

1. Pergi ke [sentry.io](https://sentry.io) dan daftar (percuma untuk
   penggunaan kecil — cukup untuk satu bengkel).
2. Cipta **Project** baharu.
3. Bila diminta pilih platform, pilih **Browser JavaScript**.
4. Bagi nama projek, contoh: `mr4x4-auto-service`.

## 2. Dapatkan DSN

Selepas projek dicipta, Sentry akan tunjuk kod pemasangan yang mengandungi
`dsn: "https://xxxxx@xxxx.ingest.sentry.io/xxxxx"`. Salin nilai DSN itu
(URL panjang tu).

Boleh juga cari semula bila-bila masa di **Settings → Projects → [nama
projek anda] → Client Keys (DSN)**.

## 3. Masukkan DSN dalam kod

Beritahu saya (Claude) DSN tersebut, dan saya akan masukkan ke dalam
`src/error-monitoring.js`:

```js
const SENTRY_DSN = 'https://xxxxx@xxxx.ingest.sentry.io/xxxxx'; // <- DSN anda di sini
```

Kemudian jalankan `npm run build` untuk hasilkan semula fail HTML, dan
deploy seperti biasa.

## 4. Sahkan ia berfungsi

Selepas deploy, buka app dan buat sesuatu yang sengaja gagal (contoh: putus
sambungan internet, cuba simpan). Semak dashboard Sentry — ralat patut
muncul dalam beberapa saat.

## Apa yang dihantar ke Sentry

- Ralat JavaScript yang tidak dijangka (crash, exception)
- Ralat sync yang gagal (contoh: talian internet terputus semasa simpan)
- ID, nama, dan peranti (Admin/Mekanik) staf yang alami ralat tersebut —
  untuk bantu kenal pasti punca, **bukan** e-mel atau data pelanggan

## Kos

Pelan percuma Sentry cukup untuk bengkel kecil (had bulanan yang munasabah
untuk bilangan ralat). Kalau had itu dicapai, Sentry hanya berhenti terima
ralat baharu sehingga bulan depan — app anda tetap berfungsi seperti biasa,
cuma anda takkan dapat laporan ralat tambahan bulan tersebut.
