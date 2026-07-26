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

## 5. Sahkan Amaran E-mel Aktif

Ralat muncul dalam dashboard Sentry tidak bermakna e-mel akan dihantar —
dua tetapan berasingan perlu disemak. Ini penting: kalau tetapan ni tak
aktif, ralat sebenar (macam insiden invois sebelum ini) hanya akan nampak
kalau anda **secara aktif buka dashboard Sentry** untuk semak, bukan
dimaklumkan secara automatik.

**A. Tetapan peribadi (akaun anda)**
1. Log masuk [sentry.io](https://sentry.io) → klik gambar profil (sudut
   kanan atas) → **User Settings** (atau ikon gear kecil sebelah nama)
2. Pergi ke tab **Notifications**
3. Pastikan **Issue Alerts** / **Alerts** ditetapkan **On** (bukan "Off"
   atau "Only on issues I'm assigned" — anda nak SEMUA ralat baharu, bukan
   ralat yang ditugaskan khas kepada anda)

**B. Tetapan projek (alert rule)**
1. Buka projek `mr4x4-auto-service` di Sentry
2. **Settings** (projek, bukan akaun) → **Alerts** → tab **Rules**
3. Patut ada satu rule sedia-ada (Sentry cipta automatik bila projek
   dibuat) — biasanya "Send a notification for new issues". Kalau **tiada**
   rule langsung, cipta satu: **Create Alert Rule** → syarat "A new issue
   is created" → tindakan "Send a notification to..." → pilih e-mel/ahli
   projek → **Save**
4. Pada rule tu ada butang **Send Test Notification** — tekan untuk uji
   e-mel sampai betul-betul (semak juga folder **Spam/Junk** buat kali
   pertama)

Kalau kedua-dua di atas sudah **On**, lain kali ralat sebenar berlaku
(seperti checkout gagal), e-mel patut sampai dalam beberapa minit tanpa
perlu tunggu staf komplain dahulu.
