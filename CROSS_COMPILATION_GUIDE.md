# Panduan Cross-Compilation: macOS Apple Silicon → Windows

Karena aplikasi menggunakan native modules (`@serialport/bindings-cpp` dan `speaker`), cross-compilation dari macOS Apple Silicon (ARM64) ke Windows x64 memerlukan approach khusus.

## Masalah

Error yang muncul:
```
Error: C:\Users\X9s\AppData\Local\Temp\32d48823-2f4f-4236-91b6-34ae4996c412.tmp.node is not a valid Win32 application.
```

Ini disebabkan karena native modules di-compile untuk macOS ARM64, bukan Windows x64.

## Solusi 1: GitHub Actions (Direkomendasikan)

Gunakan GitHub Actions untuk build di Windows environment asli:

1. Push kode ke repository GitHub
2. GitHub Actions akan otomatis build di Windows
3. Download installer dari Artifacts

File `.github/workflows/build-windows.yml` sudah tersedia di repository.

### Cara Menggunakan:
1. `git add .`
2. `git commit -m "Update untuk build"`
3. `git push origin main`
4. Buka GitHub → Actions → tunggu build selesai
5. Download installer dari Artifacts

## Solusi 2: Docker (Alternative)

Jika memiliki Docker, bisa menggunakan Windows container:

```bash
# Belum diimplementasi - memerlukan Windows Docker containers
```

## Solusi 3: Windows Virtual Machine

Build di Windows VM atau Windows PC:

1. Clone repository di Windows
2. Install Node.js dan Python di Windows
3. Run `npm install` dan `npm run build:win-x64`

## Solusi 4: Prebuilt Binaries (Workaround)

Jika ingin build lokal di macOS, bisa mencoba:

```bash
# Install dependencies dengan target Windows
npm_config_target=28.3.3 \
npm_config_arch=x64 \
npm_config_target_arch=x64 \
npm_config_disturl=https://electronjs.org/headers \
npm_config_runtime=electron \
npm_config_target_platform=win32 \
npm install --build-from-source

# Kemudian build
npm run build:win-x64
```

## Script Otomatis

Sudah tersedia script untuk mencoba force rebuild:

```bash
yarn force-rebuild-win  # Rebuild native modules untuk Windows
yarn build:win-x64      # Build installer
```

## Rekomendasi

**Untuk development reguler**: Gunakan GitHub Actions
**Untuk testing cepat**: VM Windows atau PC Windows
**Untuk production**: Selalu gunakan GitHub Actions atau Windows CI/CD

## Tips Troubleshooting

1. **Jika masih error**: Hapus `node_modules` dan `package-lock.json`, kemudian `npm install` ulang
2. **Jika GitHub Actions fail**: Check logs untuk dependency atau permission issues
3. **Jika installer rusak**: Pastikan tidak ada antivirus yang memblokir proses build

## File Output

Hasil build akan tersimpan di:
- Local: `dist/NC Soft - Nurse Call System Setup 1.0.0.exe`
- GitHub Actions: Download dari Artifacts tab 