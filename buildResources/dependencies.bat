@echo off
echo Checking system dependencies...

:: Check for Visual C++ Redistributable
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>&1
if %errorlevel% neq 0 (
    reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" >nul 2>&1
    if %errorlevel% neq 0 (
        echo Visual C++ Redistributable not found. Please install it from:
        echo https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo.
        echo Or the installer will attempt to download it automatically.
        goto :eof
    )
)

echo All dependencies are installed. 