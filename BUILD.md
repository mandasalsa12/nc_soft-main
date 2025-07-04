# NC Soft - Nurse Call System Build Guide

## Build Setup EXE untuk Windows

Aplikasi ini menggunakan Electron dan dapat dibuild menjadi installer setup exe untuk Windows.

### Prerequisites
- Node.js (versi 16 atau lebih tinggi)
- Yarn package manager
- Windows atau macOS (dengan Wine untuk cross-platform build)

### Build Commands

```bash
# Install dependencies
yarn install

# Build untuk Windows x64 (Recommended)
yarn build:win-x64

# Build untuk Windows ARM64
yarn build:win

# Build untuk Windows 32-bit
yarn build:win-ia32

# Build untuk direktori tanpa installer
yarn build:dir
```

### Hasil Build

Setelah build selesai, file installer akan tersimpan di folder `dist/`:

- **NC Soft - Nurse Call System Setup 1.0.0.exe** (137MB) - Multi-architecture installer
- **win-unpacked/** - Windows x64 unpacked (untuk testing)
- **win-ia32-unpacked/** - Windows 32-bit unpacked (untuk testing)
- **builder-effective-config.yaml** - Konfigurasi build yang digunakan

### Konfigurasi Aplikasi

- **App ID**: `com.ams-indo.ncsoft`
- **Product Name**: NC Soft - Nurse Call System
- **Publisher**: AMS Indo
- **Installer Type**: NSIS (Windows)

### Fitur Installer

- ✅ Bisa memilih direktori instalasi
- ✅ Membuat desktop shortcut
- ✅ Membuat start menu shortcut
- ✅ Uninstaller otomatis
- ✅ Include sound files dan images
- ✅ Include dependency checker scripts
- ✅ Auto-rebuild native modules untuk target platform

### File yang Disertakan

- Semua file aplikasi (HTML, JS, CSS)
- Folder `sounds/` dengan semua file audio
- Folder `images/` dengan semua file gambar
- Native dependencies (serialport, speaker)
- `dependencies.bat` - Batch script untuk check dependencies
- `install-dependencies.ps1` - PowerShell script auto-installer
- `DEPENDENCIES.md` - Dokumentasi lengkap dependencies

### Catatan

- File installer berukuran 137MB (include x64 + ia32 architectures)
- Kompatibel dengan Windows 7, 8, 10, dan 11 (x64 dan ia32)
- Memerlukan Visual C++ Redistributable 2015-2022
- Otomatis detect dan install architecture yang tepat
- Include dependency auto-installer scripts
- **FIXED**: Native modules error untuk semua Windows architectures

### Troubleshooting

#### Build Issues:
1. Pastikan semua dependencies terinstall: `yarn install`
2. Clear cache: `yarn cache clean`
3. Rebuild native modules: `yarn postinstall`
4. Coba build ulang

#### Runtime Error "not a valid Win32 application":
**SOLVED** ✅ Di installer yang baru:
1. Multi-architecture support (x64 + ia32)
2. Include dependency auto-installer
3. Pre-compiled native modules untuk semua architectures

#### Jika User Masih Error Setelah Install:
```powershell
# Run dependency installer
.\install-dependencies.ps1
```

Atau manual install Visual C++ Redistributable:
- Download: https://aka.ms/vs/17/release/vc_redist.x64.exe

### Custom Icon

Untuk menggunakan icon custom, simpan file berikut di folder `build/`:
- `icon.ico` (256x256 px untuk Windows)
- `icon.icns` (untuk macOS)
- `icon.png` (512x512 px)

Kemudian uncomment baris icon di `package.json`.

## Auto-Install Dependencies

Installer include beberapa script untuk auto-install dependencies:

### PowerShell Script (Recommended)
```powershell
# Run setelah instalasi aplikasi
.\install-dependencies.ps1
```

**Features:**
- ✅ Auto-detect missing dependencies
- ✅ Download VC++ Redistributable otomatis
- ✅ Silent installation
- ✅ Progress indicator dan error handling
- ✅ Admin privilege detection

### Batch Script (Simple)
```batch
# Check dependencies saja
.\dependencies.bat
```

**Features:**
- ✅ Quick check registry untuk VC++ Redistributable
- ✅ Display download links jika missing
- ✅ Compatible dengan semua Windows version

### Manual Links

Jika auto-installer gagal, download manual:

- **VC++ x64**: https://aka.ms/vs/17/release/vc_redist.x64.exe
- **VC++ x86**: https://aka.ms/vs/17/release/vc_redist.x86.exe

### Dependencies yang Dibutuhkan

1. **Microsoft Visual C++ Redistributable 2015-2022**
   - Diperlukan untuk native modules (SerialPort, Speaker)
   - Auto-downloaded oleh installer script

2. **Windows Audio System**
   - Sudah tersedia di Windows 7+
   - Tidak perlu instalasi tambahan

3. **Serial Port Drivers**
   - USB-to-Serial drivers (jika pakai konverter)
   - Biasanya auto-detect di Windows 