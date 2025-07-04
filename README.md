# Nurse Call System

Aplikasi Nurse Call System berbasis Electron yang mendukung komunikasi serial port untuk sistem panggilan perawat.

## Fitur

- Koneksi serial port untuk komunikasi dengan hardware
- Baud rate tetap 9600 bps
- Dukungan untuk Windows dan macOS
- Antarmuka pengguna yang intuitif
- Riwayat panggilan
- Konfigurasi tampilan yang fleksibel
- Notifikasi suara
- Panel pengujian terintegrasi

## Persyaratan Sistem

- Node.js 14.0.0 atau lebih baru
- npm 6.0.0 atau lebih baru
- Windows 10/11 atau macOS 10.13+

## Instalasi

1. Clone repositori ini
2. Install dependensi:
```bash
npm install
```

3. Jalankan aplikasi dalam mode development:
```bash
npm start
```

4. Untuk membangun aplikasi:
```bash
npm run build
```

## Penggunaan

1. Pilih port COM yang tersedia dari dropdown
2. Baud rate sudah diatur tetap di 9600 bps
3. Klik "Connect" untuk memulai koneksi
4. Gunakan panel pengujian untuk mensimulasikan panggilan
5. Atur format tampilan dan durasi alert sesuai kebutuhan

## Format Data

Aplikasi mengharapkan data dalam format 3 digit:
- 2 digit pertama: nomor ruangan (01-99)
- 1 digit terakhir: nomor tempat tidur (1-9)

Contoh: "101" untuk Ruangan 10, Tempat Tidur 1

## Lisensi

ISC 

//13052025-sekarang pada home hapus card Connection Settings, dan card Display Configuration. tanpa merusak fungsi fungsi lain yang sudah berfungsi. atur lagi tata letaknya. untuk listen port available sekarang ada di master settings