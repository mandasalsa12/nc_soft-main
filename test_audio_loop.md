# Test Audio Looping System

## Penjelasan Sistem Baru

Sistem audio telah dimodifikasi untuk memiliki fitur looping otomatis dengan delay 5 detik antar loop:

### Fitur Baru:
1. **Continuous Looping**: Ketika trigger code 10x (misal 101), sistem akan memainkan v1, v2, v3, v4, v5, v6 secara berurutan
2. **Delay Between Loops**: Setelah selesai satu loop (v1-v6), sistem menunggu 5 detik sebelum memulai loop berikutnya
3. **Infinite Loop**: Proses ini akan berlanjut terus menerus sampai ada reset code 90x (misal 901)
4. **Proper Cleanup**: Ketika reset code diterima, semua audio dan timeout loop akan dihentikan

## Cara Testing:

### Test 1: Basic Looping
1. Buka aplikasi
2. Masukkan code `101` di manual input
3. **Expected Result**: 
   - Audio v1, v2, v3, v4, v5, v6 akan dimainkan berurutan
   - Setelah v6 selesai, tunggu 5 detik
   - Loop dimulai lagi dari v1
   - Proses ini berulang terus

### Test 2: Reset During Loop
1. Saat audio sedang looping (misal di v3 loop ke-2)
2. Masukkan reset code `901`
3. **Expected Result**:
   - Audio langsung berhenti
   - Tidak ada delay timeout yang tertinggal
   - Loop tidak berlanjut

### Test 3: Reset During Delay
1. Tunggu sampai audio selesai satu loop penuh
2. Saat dalam delay 5 detik sebelum loop berikutnya
3. Masukkan reset code `901`
4. **Expected Result**:
   - Delay timeout dibatalkan
   - Loop berikutnya tidak dimulai

### Test 4: Multiple Codes
1. Masukkan code `101`
2. Tunggu beberapa loop
3. Masukkan code `102` (seharusnya mengganti audio yang sedang playing)
4. **Expected Result**:
   - Audio `101` berhenti
   - Audio `102` mulai looping
   - Hanya satu audio yang playing pada satu waktu

## Console Logs untuk Debugging:

Saat testing, perhatikan console logs berikut:
- `🚀 Audio looping sequence started for code: XXX`
- `🔊 Sending audio command - Code: XXX, Sound: YYY (N/M), Loop: N`
- `🔄 Completed loop N for code: XXX - waiting 5 seconds before next loop`
- `🔁 Starting loop N for code: XXX`
- `🛑 Stopping persistent looping audio for code: XXX`
- `✅ Successfully stopped looping audio for code: XXX`

## File yang Dimodifikasi:

### main.js:
- `persistent-audio-ended` handler: Menangani loop logic
- `play-persistent-sounds` handler: Start looping sequence
- `stop-persistent-sounds` handler: Stop dengan cleanup timeout
- `sendAudioToMainWindow()`: Enhanced logging
- `stopCurrentAudio()`: Clear loop timeout
- Added `loopDelayTimeout` variable untuk tracking timeout

### Tidak Ada Perubahan di:
- index.html (audio handler tetap sama)
- display.html (audio handler tetap sama)

## Expected Behavior Summary:

1. **Trigger 10X**: Start continuous audio loop (v1→v2→v3→v4→v5→v6→delay 5s→repeat)
2. **Trigger 90X**: Stop audio loop immediately dan cleanup semua timeout
3. **Navigation**: Audio tetap berjalan saat pindah antara index.html dan display.html
4. **Multiple Triggers**: Trigger baru akan stop audio lama dan start yang baru

## Testing Commands:

Via manual input atau serial:
- `101` - Start looping audio untuk kode 101
- `901` - Stop looping audio untuk kode 101
- `102` - Start looping audio untuk kode 102 (stop yang lama)
- `902` - Stop looping audio untuk kode 102

# Test Audio Navigation - UPDATED

## Perbaikan Yang Dilakukan

### 1. Improved Main Process Audio Management
- Audio command sekarang dikirim ke semua windows yang ada
- Fungsi `sendAudioToMainWindow()` dan `stopCurrentAudio()` telah diperbaiki
- Audio state preservation yang lebih robust saat navigasi

### 2. Enhanced Global Audio Element Management
- Semua halaman (index.html, display.html, display_config.html) memiliki `ensureGlobalAudioElement()` yang konsisten
- Audio element dibuat ulang jika tidak ada atau ter-disconnect dari DOM
- Lebih banyak event listeners untuk debugging
- Flag `audioElementInitialized` untuk mencegah multiple initialization

### 3. Better Navigation Audio Preservation
- Improved logging saat save/restore audio state
- Audio restoration dipanggil secara otomatis saat halaman dimuat
- Support untuk actively playing audio dan saved audio states

## Skenario Test

### Test 1: Audio Navigation Index → Display
1. Mulai audio di index.html (misalnya test code 101)
2. Klik FAB Display atau navigasi ke display.html
3. ✅ Audio harus tetap berjalan tanpa terputus
4. Audio harus terlihat di display.html dengan visual blinking

### Test 2: Audio Navigation Display → Index
1. Mulai audio di display.html 
2. Spam click logo untuk kembali ke index.html
3. ✅ Audio harus tetap berjalan tanpa terputus
4. Audio status harus terlihat di active alerts index.html

### Test 3: Audio Navigation Index → Display Config
1. Mulai audio di index.html
2. Buka Master Settings → Display Config
3. ✅ Audio harus tetap berjalan tanpa terputus
4. Bisa test shapes dengan live audio

### Test 4: Audio Loop Continuity
1. Mulai audio looping sequence (misalnya 101 dengan multiple sounds)
2. Navigasi berkali-kali antar halaman selama audio loop
3. ✅ Audio loop harus tetap smooth, tidak restart dari awal

### Test 5: Audio Reset During Navigation
1. Mulai audio di halaman manapun
2. Saat navigasi ke halaman lain
3. Kirim reset code (misalnya 901)
4. ✅ Audio harus berhenti di semua halaman

## Perbaikan Teknis

### Main Process (main.js)
- `sendAudioToMainWindow()`: Kirim ke semua windows + error handling
- `stopCurrentAudio()`: Stop di semua windows + error handling  
- Enhanced logging untuk audio state preservation
- Improved `audio-element-ready` dan `restore-audio-after-navigation` handlers

### All HTML Files
- Consistent `ensureGlobalAudioElement()` implementation
- Better audio source management (prevent unnecessary reloads)
- Automatic audio restoration pada page load
- Enhanced error handling dan logging

## Expected Behavior
Audio sekarang harus berjalan **smooth di background** tanpa terputus saat navigasi antar halaman apapun. Sistem akan secara otomatis:

1. Save audio state sebelum navigasi
2. Restore audio state setelah halaman baru dimuat
3. Continue audio dari posisi yang sama tanpa restart
4. Handle loop audio dengan benar
5. Sync audio commands ke semua windows yang aktif 