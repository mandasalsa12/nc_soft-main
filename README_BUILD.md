# NC Soft - Nurse Call System 🏥

## Status Build untuk Windows

⚠️ **PENTING**: Ada issue dengan build Windows dari macOS Apple Silicon.

### Masalah yang Ditemui

Ketika aplikasi di-build dari macOS Apple Silicon untuk Windows, muncul error:

```
Error: C:\Users\X9s\AppData\Local\Temp\32d48823-2f4f-4236-91b6-34ae4996c412.tmp.node is not a valid Win32 application.
```

### Penyebab

Aplikasi menggunakan native modules:
- `@serialport/bindings-cpp` untuk komunikasi serial
- `speaker` untuk audio output

Native modules ini tidak bisa di-cross-compile dari macOS ARM64 ke Windows x64 dengan mudah.

### Solusi ✅

#### 1. GitHub Actions (DIREKOMENDASIKAN)

File `.github/workflows/build-windows.yml` sudah disiapkan.

**Langkah**:
1. Push kode ke GitHub repository
2. GitHub Actions akan build di Windows environment asli
3. Download installer dari Actions → Artifacts

#### 2. Build di Windows

Jika memiliki Windows PC/VM:
```bash
git clone <repository>
cd nc_soft-main
yarn install
yarn build:win-x64
```

### Files Terkait Build

- **`.github/workflows/build-windows.yml`** - GitHub Actions workflow
- **`scripts/force-rebuild-win.js`** - Script rebuild (experimental)
- **`BUILD_SOLUTIONS.md`** - Dokumentasi lengkap solusi
- **`CROSS_COMPILATION_GUIDE.md`** - Panduan detail

### Development Workflow

1. **Development** → macOS (normal)
2. **Testing** → `yarn start` di macOS
3. **Windows Build** → GitHub Actions
4. **Testing Windows** → Download installer dan test di Windows

### Installation Guide (untuk User)

Installer yang di-build dengan GitHub Actions sudah include:
- ✅ Semua dependencies yang dibutuhkan
- ✅ Auto-installer untuk Visual C++ Redistributable
- ✅ Support Windows 7, 8, 10, 11
- ✅ Architecture detection (x64/ia32)

### Troubleshooting

Jika installer error di Windows:
1. Download dan install Visual C++ Redistributable 2015-2022
2. Run installer as Administrator
3. Check antivirus tidak memblokir

### Technical Details

**Native Modules**:
- `@serialport/bindings-cpp@12.0.1` - Serial port communication
- `speaker@0.5.5` - Audio output

**Target Platform**: Windows 10/11 x64
**Electron Version**: 28.3.3
**Node Module Version**: 119

---

**Status**: ✅ Solusi tersedia via GitHub Actions
**Compatibility**: Windows 7+ (x64 recommended) 