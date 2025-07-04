# NC Soft - System Dependencies

## Dependencies yang Dibutuhkan

Aplikasi NC Soft memerlukan komponen berikut untuk berjalan dengan optimal:

### 1. Microsoft Visual C++ Redistributable 2015-2022

**Mengapa dibutuhkan:**
- Untuk menjalankan native modules (SerialPort, Speaker)
- Diperlukan oleh Electron runtime
- Komponen standard Windows development

**Download:**
- **Windows x64**: https://aka.ms/vs/17/release/vc_redist.x64.exe
- **Windows x86**: https://aka.ms/vs/17/release/vc_redist.x86.exe

### 2. Windows Audio System

**Sudah tersedia di:**
- Windows 7 dan yang lebih baru
- Tidak perlu instalasi tambahan

### 3. USB/Serial Port Drivers

**Untuk komunikasi dengan perangkat:**
- Driver USB-to-Serial (jika menggunakan konverter USB)
- Driver COM port perangkat
- Biasanya otomatis terdeteksi Windows

## Instalasi Otomatis

Installer NC Soft akan secara otomatis:

1. ✅ **Deteksi dependencies** yang missing
2. ✅ **Download** VC++ Redistributable jika diperlukan
3. ✅ **Install** secara silent (tanpa user input)
4. ✅ **Verify** instalasi berhasil

## Manual Installation

Jika auto-install gagal, install manual:

### Visual C++ Redistributable:
1. Download dari link di atas
2. Run sebagai Administrator
3. Follow wizard instalasi
4. Restart aplikasi NC Soft

### Verification
Jalankan file `dependencies.bat` yang disertakan untuk check status.

## Troubleshooting

### Error "MSVCP140.dll missing"
- Install/reinstall VC++ Redistributable
- Restart komputer

### Error "Cannot access COM port"
- Check driver perangkat serial
- Verify port tersedia di Device Manager
- Run aplikasi sebagai Administrator

### Audio tidak keluar
- Check Windows audio service
- Verify default audio device
- Check volume mixer

## Technical Details

**App ID**: com.ams-indo.ncsoft  
**Platform**: Windows 7, 8, 10, 11  
**Architecture**: x64 (Recommended), x86, ARM64  
**Runtime**: Electron 28.x dengan Node.js embedded  

## Support

Untuk bantuan teknis, hubungi support AMS Indo atau check dokumentasi aplikasi. 