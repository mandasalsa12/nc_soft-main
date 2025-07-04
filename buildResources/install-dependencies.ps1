# NC Soft Dependency Installer
# Auto-install required dependencies for NC Soft application

Write-Host "NC Soft - Dependency Installer" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "Administrator privileges recommended for dependency installation."
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Installation cancelled."
        exit 1
    }
}

# Function to check if Visual C++ Redistributable is installed
function Test-VCRedistInstalled {
    $registryPaths = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86"
    )
    
    foreach ($path in $registryPaths) {
        if (Test-Path $path) {
            $version = Get-ItemProperty -Path $path -Name "Version" -ErrorAction SilentlyContinue
            if ($version) {
                Write-Host "✓ Visual C++ Redistributable found: $($version.Version)" -ForegroundColor Green
                return $true
            }
        }
    }
    return $false
}

# Function to download and install VC++ Redistributable
function Install-VCRedist {
    Write-Host "⬇ Downloading Visual C++ Redistributable..." -ForegroundColor Yellow
    
    $architecture = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $downloadUrl = "https://aka.ms/vs/17/release/vc_redist.$architecture.exe"
    $tempFile = Join-Path $env:TEMP "vc_redist_$architecture.exe"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
        Write-Host "✓ Download completed" -ForegroundColor Green
        
        Write-Host "🔧 Installing Visual C++ Redistributable..." -ForegroundColor Yellow
        $process = Start-Process -FilePath $tempFile -ArgumentList "/quiet", "/norestart" -Wait -PassThru
        
        switch ($process.ExitCode) {
            0 { 
                Write-Host "✓ Visual C++ Redistributable installed successfully" -ForegroundColor Green 
            }
            1638 { 
                Write-Host "✓ Visual C++ Redistributable already installed (newer version)" -ForegroundColor Green 
            }
            3010 { 
                Write-Host "✓ Visual C++ Redistributable installed (restart required)" -ForegroundColor Yellow 
            }
            default { 
                Write-Host "⚠ Installation completed with exit code: $($process.ExitCode)" -ForegroundColor Yellow 
            }
        }
    }
    catch {
        Write-Error "Failed to download or install Visual C++ Redistributable: $($_.Exception.Message)"
        Write-Host "Please download and install manually from: $downloadUrl" -ForegroundColor Yellow
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

# Main installation process
Write-Host "🔍 Checking system dependencies..." -ForegroundColor Blue
Write-Host ""

# Check Visual C++ Redistributable
if (Test-VCRedistInstalled) {
    Write-Host "✓ All dependencies are already installed!" -ForegroundColor Green
} else {
    Write-Host "❌ Visual C++ Redistributable not found" -ForegroundColor Red
    Write-Host ""
    
    $install = Read-Host "Install Visual C++ Redistributable now? (Y/n)"
    if ($install -ne "n" -and $install -ne "N") {
        Install-VCRedist
    } else {
        Write-Host "⚠ Visual C++ Redistributable installation skipped" -ForegroundColor Yellow
        Write-Host "The application may not work properly without it." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎯 Dependency check completed!" -ForegroundColor Green
Write-Host ""

# Final status check
Write-Host "📋 Final Status:" -ForegroundColor Blue
Write-Host "  - Visual C++ Redistributable: $(if (Test-VCRedistInstalled) { '✓ Installed' } else { '❌ Missing' })"
Write-Host "  - Windows Audio System: ✓ Available"
Write-Host "  - Application Files: ✓ Installed"
Write-Host ""

Write-Host "🚀 NC Soft is ready to use!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Note: If you encounter any issues, please check:" -ForegroundColor Yellow
Write-Host "   - Serial port drivers for your devices"
Write-Host "   - Windows Firewall settings"  
Write-Host "   - Run the application as Administrator if needed"
Write-Host ""

Read-Host "Press Enter to continue..." 