# Testing Koordinat Shape

## Langkah untuk Test Koordinat Konsisten

### 1. Buka display_config.html
- Upload floor plan
- Tambah shape di posisi tertentu (misal: tengah gambar)
- Catat koordinat di console log
- Save konfigurasi

### 2. Buka display.html  
- Pastikan shape muncul di posisi yang sama persis
- Periksa console log untuk koordinat yang sama

### 3. Test dengan Debug File
- Buka display_debug.html
- Klik "Load Data" untuk melihat koordinat tersimpan
- Klik "Save Test Position" untuk menambah shape test
- Verifikasi posisi (200, 150) muncul konsisten

## Perbaikan yang Dilakukan

### Layout Consistency
- Grid layout yang sama: `xl:col-span-3`
- Container yang identik
- Canvas positioning yang sama

### Rendering System
- `renderShapes()` menggunakan logika yang sama
- Canvas setup yang identik
- Koordinat offset yang konsisten

### Debug Features
- Console logging untuk canvas positioning
- Shape position logging
- Debug file untuk verifikasi data

## Expected Results

Setelah perbaikan:
1. Shape di display_config.html dan display.html harus terlihat di posisi PERSIS SAMA
2. Console log menunjukkan koordinat yang identik
3. Tidak ada perbedaan offset atau scaling

## Troubleshooting

Jika masih ada perbedaan:
1. Periksa console log untuk canvas positioning
2. Bandingkan koordinat shape di kedua halaman
3. Gunakan display_debug.html untuk verifikasi data tersimpan
4. Pastikan layout grid menggunakan `xl:col-span-3` yang sama 