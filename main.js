const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');

// Suppress NODE_OPTIONS warnings dan berbagai warning Electron lainnya
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.NODE_OPTIONS = '';
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Override console.error untuk menyembunyikan warning NODE_OPTIONS
const originalConsoleError = console.error;
console.error = (...args) => {
    const message = args.join(' ');
    if (!message.includes('Most NODE_OPTIONs are not supported in packaged apps') && 
        !message.includes('node_bindings.cc') &&
        !message.includes('VizDisplayCompositor')) {
        originalConsoleError.apply(console, args);
    }
};

try {
    require('@electron/remote/main').initialize();
} catch (e) {
    console.error('Error initializing @electron/remote:', e);
}

let mainWindow;
let displayWindow;
let serialPort = null;
let standbyNotificationShown = false;
let masterData = [];
let shapes = [];
let floorplanImg = '';
let selectedShapeId = null;
let isNavigatingFromDisplay = false; // Flag untuk tracking navigation dari display
let sharedCallHistory = []; // Shared call history antara index.html dan display.html
let sharedActiveAlerts = []; // Shared active alerts antara index.html dan display.html
let persistentSounds = new Map(); // Persistent sounds yang tetap jalan
let persistentBlinking = new Map(); // Persistent blinking yang tetap jalan
let globalAudioPlayer = null; // Global audio player untuk continuous playback
let currentAudioSequence = null; // Current audio sequence
let isAudioPlaying = false; // Track audio status
let sharedAudioWindow = null; // Dedicated hidden window for audio playback
let currentlyPlayingAudio = null; // Currently playing audio info
let audioElementExists = false; // Track if audio element exists
let loopDelayTimeout = null; // Timeout reference for loop delay

// Fungsi untuk mendapatkan path sounds yang benar
function getSoundsPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'sounds');
    }
    return path.join(__dirname, 'sounds');
}

// Fungsi untuk memastikan direktori sounds ada
function ensureSoundsDirectory() {
    const soundsDir = getSoundsPath();
    if (!fs.existsSync(soundsDir)) {
        fs.mkdirSync(soundsDir, { recursive: true });
    }
    return soundsDir;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    try {
        require('@electron/remote/main').enable(mainWindow.webContents);
    } catch (e) {
        console.error('Error enabling remote module:', e);
    }

    mainWindow.loadFile('index.html');
    
    // Uncomment untuk debugging
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Also close shared audio window if exists
        if (sharedAudioWindow) {
            sharedAudioWindow.close();
            sharedAudioWindow = null;
        }
    });
}

function createSharedAudioWindow() {
    if (sharedAudioWindow) {
        return sharedAudioWindow;
    }

    sharedAudioWindow = new BrowserWindow({
        width: 1,
        height: 1,
        show: false, // Hidden window
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    try {
        require('@electron/remote/main').enable(sharedAudioWindow.webContents);
    } catch (e) {
        console.error('Error enabling remote module for audio window:', e);
    }

    // Create HTML content for audio window
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Audio Player</title>
        </head>
        <body>
            <audio id="shared-audio" preload="auto"></audio>
            <script>
                const { ipcRenderer } = require('electron');
                let audioElement = document.getElementById('shared-audio');
                let currentPlayingCode = null;
                let currentPlayingIndex = -1;

                console.log('Shared audio window initializing...');

                // Listen for audio playback commands
                ipcRenderer.on('play-shared-audio', (event, { code, soundFile, currentIndex, totalSounds }) => {
                    console.log('Shared audio window received play command:', { code, soundFile, currentIndex, totalSounds });
                    
                    currentPlayingCode = code;
                    currentPlayingIndex = currentIndex;
                    
                    // Set source using file:// protocol for absolute paths
                    if (soundFile.startsWith('/') || soundFile.includes(':\\\\')) {
                        audioElement.src = 'file://' + soundFile;
                    } else {
                        audioElement.src = soundFile;
                    }
                    
                    console.log('Audio element src set to:', audioElement.src);
                    
                    audioElement.onended = () => {
                        console.log('Shared audio ended:', audioElement.src);
                        ipcRenderer.send('shared-audio-ended', { code: currentPlayingCode, currentIndex: currentPlayingIndex });
                    };
                    
                    audioElement.onerror = (error) => {
                        console.error('Shared audio error:', error, 'Source:', audioElement.src);
                        console.error('Error details:', error.target.error);
                        ipcRenderer.send('shared-audio-ended', { code: currentPlayingCode, currentIndex: currentPlayingIndex });
                    };
                    
                    audioElement.oncanplaythrough = () => {
                        console.log('Audio can play through, starting playback...');
                        audioElement.play().then(() => {
                            console.log('Audio started playing successfully');
                        }).catch(error => {
                            console.error('Failed to play shared audio:', error);
                            ipcRenderer.send('shared-audio-ended', { code: currentPlayingCode, currentIndex: currentPlayingIndex });
                        });
                    };
                    
                    audioElement.onloadstart = () => {
                        console.log('Audio loading started...');
                    };
                    
                    audioElement.onloadeddata = () => {
                        console.log('Audio data loaded');
                    };
                });

                // Listen for stop commands
                ipcRenderer.on('stop-shared-audio', () => {
                    console.log('Stopping shared audio');
                    audioElement.pause();
                    audioElement.currentTime = 0;
                    currentPlayingCode = null;
                    currentPlayingIndex = -1;
                });

                console.log('Shared audio window ready');
                
                // Test audio element
                console.log('Audio element test:', audioElement.canPlayType('audio/wav'));
            </script>
        </body>
        </html>
    `;
    
    sharedAudioWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    sharedAudioWindow.on('closed', () => {
        sharedAudioWindow = null;
    });

    return sharedAudioWindow;
}

function createDisplayWindow() {
    displayWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    try {
        require('@electron/remote/main').enable(displayWindow.webContents);
    } catch (e) {
        console.error('Error enabling remote module for display window:', e);
    }

    displayWindow.loadFile('display.html');
    
    displayWindow.on('closed', () => {
        displayWindow = null;
    });
}

function sendNotification(type, message) {
    if (mainWindow) {
        mainWindow.webContents.send('notification', { type, message });
    }
}

function saveConfig(data) {
    const configPath = path.join(__dirname, 'config.json');
    try {
        if (!data) {
            console.error('Invalid data to save:', data);
            return false;
        }

        if (!fs.existsSync(configPath)) {
            const initialData = {
                masterData: [],
                masterSettings: {},
                alertSettings: {
                    displayFormat: "K{room}B{bed}",
                    customFormat: "",
                    alertDuration: 30,
                    soundEnabled: false
                },
                callHistoryStorage: [] // Persistent call history storage
            };
            fs.writeFileSync(configPath, JSON.stringify(initialData, null, 2));
        }

        const existingData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const newData = {
            ...existingData,
            ...data
        };

        fs.writeFileSync(configPath, JSON.stringify(newData, null, 2));
        console.log('Config saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        return false;
    }
}

function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    try {
        if (!fs.existsSync(configPath)) {
            const initialData = {
                masterData: [],
                masterSettings: {},
                alertSettings: {
                    displayFormat: "K{room}B{bed}",
                    customFormat: "",
                    alertDuration: 30,
                    soundEnabled: false
                },
                callHistoryStorage: []
            };
            fs.writeFileSync(configPath, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync(configPath, 'utf-8');
        const parsedData = JSON.parse(data);
        
        // Ensure callHistoryStorage exists
        if (!parsedData.callHistoryStorage) {
            parsedData.callHistoryStorage = [];
        }
        
        return parsedData;
    } catch (error) {
        console.error('Error loading config:', error);
        return {
            masterData: [],
            masterSettings: {},
            alertSettings: {
                displayFormat: "K{room}B{bed}",
                customFormat: "",
                alertDuration: 30,
                soundEnabled: false
            },
            callHistoryStorage: []
        };
    }
}

app.whenReady().then(() => {
    // Additional setup to suppress warnings
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    
    createMainWindow();
    
    // Fix macOS dock visibility issue (error code -50)
    if (process.platform === 'darwin') {
        app.dock.show();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

// Listen for persistent audio ended events
ipcMain.on('persistent-audio-ended', (event, { code, currentIndex }) => {
    console.log('Persistent audio ended callback for code:', code, 'index:', currentIndex);
    
    // Update current audio sequence
    if (currentAudioSequence && currentAudioSequence.code === code && isAudioPlaying) {
        currentAudioSequence.currentIndex = currentIndex + 1;
        
        // Check if we've finished all sounds in sequence
        if (currentAudioSequence.currentIndex >= currentAudioSequence.sounds.length) {
            // Reset to beginning for looping
            currentAudioSequence.currentIndex = 0;
            
            // Track loop count for debugging
            if (!currentAudioSequence.loopCount) {
                currentAudioSequence.loopCount = 1;
            } else {
                currentAudioSequence.loopCount++;
            }
            
            console.log(`🔄 Completed loop ${currentAudioSequence.loopCount} for code: ${code} - waiting 5 seconds before next loop`);
            
            // Clear any existing delay timeout
            if (loopDelayTimeout) {
                clearTimeout(loopDelayTimeout);
            }
            
            // Set delay before starting next loop
            loopDelayTimeout = setTimeout(() => {
                // Check if still should be playing (not reset)
                if (isAudioPlaying && currentAudioSequence && currentAudioSequence.code === code) {
                    console.log(`🔁 Starting loop ${currentAudioSequence.loopCount + 1} for code: ${code}`);
                    sendAudioToMainWindow();
                } else {
                    console.log(`⏹️ Audio sequence stopped during delay for code: ${code}`);
                }
                loopDelayTimeout = null;
            }, 5000); // 5 second delay
        } else {
            // Continue to next sound in current sequence
            console.log(`▶️ Playing sound ${currentAudioSequence.currentIndex}/${currentAudioSequence.sounds.length} for code: ${code}`);
            sendAudioToMainWindow();
        }
    }
});

// Auto-save call history every 5 minutes
setInterval(async () => {
    try {
        await saveCompletedCallsToPersistentStorage();
        console.log('🔄 Auto-saved call history to persistent storage');
    } catch (error) {
        console.error('Error in auto-save:', error);
    }
}, 5 * 60 * 1000); // 5 minutes

app.on('window-all-closed', async () => {
    // Save any remaining call history before closing
    try {
        await saveCompletedCallsToPersistentStorage();
        console.log('💾 Final save of call history completed');
    } catch (error) {
        console.error('Error during final save:', error);
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('open-display', (event, opts = {}) => {
    // Set flag bahwa kita akan navigasi ke display
    isNavigatingFromDisplay = false;
    console.log('[Navigation] Moving to display.html, isNavigatingFromDisplay:', isNavigatingFromDisplay);
    
    // Save current audio state before navigation - IMPROVED
    if (isAudioPlaying && currentAudioSequence) {
        currentlyPlayingAudio = {
            ...currentAudioSequence,
            timestamp: Date.now(),
            wasPlaying: true
        };
        console.log('[Audio] Saved audio state before navigation to display:', {
            code: currentlyPlayingAudio.code,
            currentIndex: currentlyPlayingAudio.currentIndex,
            totalSounds: currentlyPlayingAudio.sounds?.length || 0,
            loopCount: currentlyPlayingAudio.loopCount || 1
        });
    } else {
        console.log('[Audio] No active audio to save before navigation to display');
    }
    
    // Tentukan file target
    const targetFile = opts.target || 'display.html';
    console.log('[Navigation] Loading target file:', targetFile);
    
    if (mainWindow) {
        mainWindow.loadFile(targetFile);
    } else {
        console.error('[Navigation] Main window not available for navigation');
    }
});

ipcMain.handle('back-to-main', () => {
    // Set flag bahwa kita kembali dari display
    isNavigatingFromDisplay = true;
    console.log('[Navigation] Moving back to index.html, isNavigatingFromDisplay:', isNavigatingFromDisplay);
    
    // Save current audio state before navigation - IMPROVED
    if (isAudioPlaying && currentAudioSequence) {
        currentlyPlayingAudio = {
            ...currentAudioSequence,
            timestamp: Date.now(),
            wasPlaying: true
        };
        console.log('[Audio] Saved audio state before navigation back to main:', {
            code: currentlyPlayingAudio.code,
            currentIndex: currentlyPlayingAudio.currentIndex,
            totalSounds: currentlyPlayingAudio.sounds?.length || 0,
            loopCount: currentlyPlayingAudio.loopCount || 1
        });
    } else {
        console.log('[Audio] No active audio to save before navigation back to main');
    }
    
    // Load index.html back in main window
    if (mainWindow) {
        mainWindow.loadFile('index.html');
    } else {
        console.error('[Navigation] Main window not available for back navigation');
    }
});

// Handler untuk cek status koneksi serial
ipcMain.handle('is-serial-connected', () => {
    const connected = serialPort && serialPort.isOpen;
    console.log('[Serial] Connection status check:', connected);
    return connected;
});

// Handler untuk reset navigation flag
ipcMain.handle('reset-navigation-flag', () => {
    console.log('[Navigation] Resetting navigation flag from:', isNavigatingFromDisplay);
    isNavigatingFromDisplay = false;
    console.log('[Navigation] Navigation flag reset to:', isNavigatingFromDisplay);
    return true;
});

// Handler untuk cek apakah sedang navigasi dari display
ipcMain.handle('is-navigating-from-display', () => {
    console.log('[Navigation] Checking navigation from display:', isNavigatingFromDisplay);
    return isNavigatingFromDisplay;
});

ipcMain.handle('get-ports', async () => {
    try {
        const ports = await SerialPort.list();
        console.log('Available ports:', ports);
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            serialNumber: port.serialNumber || 'Unknown',
            vendorId: port.vendorId,
            productId: port.productId
        }));
    } catch (error) {
        console.error('Error getting ports:', error);
        return [];
    }
});

ipcMain.handle('connect-port', async (event, { port, baudRate }) => {
    try {
        console.log('Attempting to connect to port:', port, 'with baudRate:', baudRate);

        // Close existing connection if any
        if (serialPort && serialPort.isOpen) {
            console.log('Closing existing connection');
            await new Promise((resolve, reject) => {
                serialPort.close((err) => {
                    if (err) {
                        console.error('Error closing existing port:', err);
                        reject(err);
                        return;
                    }
                    console.log('Existing port closed successfully');
                    resolve();
                });
            });
        }

        // Create new serial port instance with error handling
        serialPort = new SerialPort({
            path: port,
            baudRate: parseInt(baudRate),
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        });

        // Create parser for reading data
        const parser = new ReadlineParser({ delimiter: '\r\n' });
        serialPort.pipe(parser);

        // Set up event handlers
        serialPort.on('error', (err) => {
            console.error('Serial port error:', err);
            if (mainWindow) {
                mainWindow.webContents.send('serial-error', err.message);
            }
        });

        // Open the port with proper error handling
        return new Promise((resolve, reject) => {
            serialPort.open((err) => {
                if (err) {
                    console.error('Failed to open port:', err);
                    reject(err);
                    return;
                }

                console.log('Port opened successfully');
                
                if (mainWindow) {
                    mainWindow.webContents.send('serial-status', 'connected');
                }

                parser.on('data', (data) => {
                    try {
                        const cleanData = data.toString().trim();
                        console.log('Received data:', cleanData);
                        
                        sendSerialToWindows(cleanData);
                    } catch (error) {
                        console.error('Error processing received data:', error);
                    }
                });

                resolve({ success: true, message: 'Connected successfully' });
            });
        });

    } catch (error) {
        console.error('Connection error:', error);
        throw error;
    }
});

ipcMain.handle('disconnect-port', async () => {
    try {
        if (serialPort && serialPort.isOpen) {
            return new Promise((resolve, reject) => {
                serialPort.close((err) => {
                    if (err) {
                        console.error('Error closing port:', err);
                        sendNotification('error', `Gagal menutup port: ${err.message}`);
                        reject(err);
                        return;
                    }
                    serialPort = null;
                    sendNotification('success', 'Berhasil memutuskan koneksi');
                    resolve(true);
                });
            });
        }
        return true;
    } catch (error) {
        console.error('Disconnection error:', error);
        sendNotification('error', `Gagal memutuskan koneksi: ${error.message}`);
        throw error;
    }
});

ipcMain.handle('load-config', async () => {
    return loadConfig();
});

ipcMain.handle('save-config', async (event, config) => {
    return saveConfig(config);
});

ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Sound Files', extensions: ['mp3', 'wav'] }
        ]
    });
    return result.filePaths;
});

ipcMain.handle('select-sound-files', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Sound Files', extensions: ['wav'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const soundsDir = path.join(__dirname, 'sounds');
            
            // Buat direktori sounds jika belum ada
            if (!fs.existsSync(soundsDir)) {
                fs.mkdirSync(soundsDir);
            }

            // Salin setiap file yang dipilih ke folder sounds
            for (const filePath of result.filePaths) {
                const fileName = path.basename(filePath);
                const targetPath = path.join(soundsDir, fileName);
                
                // Salin file
                fs.copyFileSync(filePath, targetPath);
            }

            return result.filePaths.map(filePath => path.basename(filePath));
        }
        return [];
    } catch (error) {
        console.error('Error selecting sound files:', error);
        throw error;
    }
});

// Tambahkan fungsi untuk menangani notifikasi sistem
function showSystemNotification(title, body, urgency = 'normal') {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: body,
            silent: false,
            urgency: urgency, // 'normal', 'critical', or 'low'
            timeoutType: 'default'
        });
        
        notification.show();
        
        // Handle click event
        notification.on('click', () => {
            // Fokuskan window utama jika diklik
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        });
    }
}

// Tambahkan handler untuk notifikasi sistem
ipcMain.handle('show-system-notification', async (event, { title, body, urgency }) => {
    showSystemNotification(title, body, urgency);
});

// Handler untuk play sounds di main process dengan looping (tidak terputus navigasi)
ipcMain.handle('play-persistent-sounds', async (event, { code, sounds }) => {
    try {
        console.log('Starting persistent looping audio sequence for code:', code, 'with', sounds.length, 'sounds');
        
        // Stop existing sound jika ada
        if (isAudioPlaying) {
            console.log('Stopping existing audio sequence');
            stopCurrentAudio();
        }
        
        // Set persistent sound state
        persistentSounds.set(code, {
            sounds: sounds,
            isPlaying: true,
            startTime: Date.now(),
            currentIndex: 0,
            isLooping: true // Flag untuk menandakan ini adalah looping sequence
        });
        
        // Start audio sequence - akan loop terus dengan delay 5 detik antar loop
        currentAudioSequence = { code, sounds, currentIndex: 0 };
        isAudioPlaying = true;
        
        // Send audio command directly to main window
        sendAudioToMainWindow();
        
        console.log(`🚀 Audio looping sequence started for code: ${code}`);
        console.log(`📝 Sequence details: ${sounds.length} sounds, will loop continuously with 5-second delay between loops`);
        console.log(`🛑 To stop this sequence, send reset code: 90${code.substring(2)}`);
        return { success: true };
    } catch (error) {
        console.error('Error playing persistent sounds:', error);
        return { success: false, error: error.message };
    }
});

// Handler untuk stop persistent sounds
ipcMain.handle('stop-persistent-sounds', async (event, { code }) => {
    try {
        // Log info about what's being stopped
        const soundData = persistentSounds.get(code);
        const currentLoop = currentAudioSequence?.loopCount || 1;
        
        console.log(`🛑 Stopping persistent looping audio for code: ${code} (was on loop ${currentLoop})`);
        
        // Remove from persistent sounds
        if (persistentSounds.has(code)) {
            persistentSounds.delete(code);
        }
        
        // Stop audio and clear any pending timeouts
        stopCurrentAudio();
        
        // Broadcast update ke semua window
        if (mainWindow) {
            mainWindow.webContents.send('persistent-sound-stopped', { code });
        }
        
        console.log(`✅ Successfully stopped looping audio for code: ${code}`);
        return { success: true };
    } catch (error) {
        console.error('Error stopping persistent sounds:', error);
        return { success: false, error: error.message };
    }
});

// Function to send audio command to main window
function sendAudioToMainWindow() {
    if (!currentAudioSequence || !isAudioPlaying) {
        return;
    }
    
    const { code, sounds, currentIndex } = currentAudioSequence;
    
    // Check if we've completed all sounds (this should now be handled in the ended callback)
    if (currentIndex >= sounds.length) {
        console.log('Reached end of sounds for code:', code, '- this should be handled by loop logic');
        return;
    }
    
    const soundFile = sounds[currentIndex];
    const soundPath = getSoundsPath();
    const fullPath = path.join(soundPath, soundFile);
    
    const currentLoop = currentAudioSequence.loopCount || 1;
    console.log(`🔊 Sending audio command - Code: ${code}, Sound: ${soundFile} (${currentIndex + 1}/${sounds.length}), Loop: ${currentLoop}`);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
        console.error('Audio file not found:', fullPath);
        // Skip to next sound
        currentAudioSequence.currentIndex = currentIndex + 1;
        sendAudioToMainWindow();
        return;
    }
    
    // Send audio command to main window - IMPROVED: Kirim ke semua window yang ada
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        if (window && window.webContents && !window.isDestroyed()) {
            try {
                console.log('Sending play-persistent-audio command to window');
                window.webContents.send('play-persistent-audio', { 
                    code, 
                    soundFile,
                    currentIndex,
                    totalSounds: sounds.length
                });
            } catch (error) {
                console.error('Error sending audio command to window:', error);
            }
        }
    });
    
    // Fallback: Also try main window specifically
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        try {
            console.log('Sending play-persistent-audio command to main window specifically');
            mainWindow.webContents.send('play-persistent-audio', { 
                code, 
                soundFile,
                currentIndex,
                totalSounds: sounds.length
            });
        } catch (error) {
            console.error('Error sending audio command to main window:', error);
        }
    }
}

// Function to stop current audio
function stopCurrentAudio() {
    console.log('Stopping current audio sequence and any pending loops');
    isAudioPlaying = false;
    currentAudioSequence = null;
    
    // Clear global audio player timeout
    if (globalAudioPlayer) {
        clearTimeout(globalAudioPlayer);
        globalAudioPlayer = null;
    }
    
    // Clear loop delay timeout to prevent next loop from starting
    if (loopDelayTimeout) {
        clearTimeout(loopDelayTimeout);
        loopDelayTimeout = null;
        console.log('Cleared pending loop delay timeout');
    }
    
    // Send stop command to all windows - IMPROVED: Kirim ke semua window
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        if (window && window.webContents && !window.isDestroyed()) {
            try {
                console.log('Sending stop-persistent-audio command to window');
                window.webContents.send('stop-persistent-audio');
            } catch (error) {
                console.error('Error sending stop audio command to window:', error);
            }
        }
    });
    
    // Fallback: Also try main window specifically
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        try {
            console.log('Sending stop-persistent-audio command to main window specifically');
            mainWindow.webContents.send('stop-persistent-audio');
        } catch (error) {
            console.error('Error sending stop audio command to main window:', error);
        }
    }
}

// Handler untuk callback dari renderer ketika audio selesai
ipcMain.handle('audio-ended', async (event, { code, currentIndex }) => {
    try {
        console.log('Audio ended callback for code:', code, 'index:', currentIndex);
        
        // Update current audio sequence
        if (currentAudioSequence && currentAudioSequence.code === code && isAudioPlaying) {
            currentAudioSequence.currentIndex = currentIndex + 1;
            
            // Continue to next sound
            sendAudioToSharedWindow();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error in audio-ended callback:', error);
        return { success: false, error: error.message };
    }
});

// Handler untuk mendapatkan status audio saat ini
ipcMain.handle('get-current-audio-status', async () => {
    try {
        return {
            isPlaying: isAudioPlaying,
            currentSequence: currentAudioSequence,
            currentlyPlayingAudio: currentlyPlayingAudio
        };
    } catch (error) {
        console.error('Error getting audio status:', error);
        return { isPlaying: false, currentSequence: null, currentlyPlayingAudio: null };
    }
});

// Handler untuk restore audio setelah navigasi
ipcMain.handle('restore-audio-after-navigation', async () => {
    try {
        console.log('[Audio] Restore audio request, currentlyPlayingAudio:', currentlyPlayingAudio);
        console.log('[Audio] Current audio state - isAudioPlaying:', isAudioPlaying, 'currentAudioSequence:', currentAudioSequence);
        
        // Jika ada audio yang sedang playing, langsung lanjutkan
        if (isAudioPlaying && currentAudioSequence) {
            console.log('[Audio] Audio is actively playing, sending current command to new page');
            
            // Send current audio command to all windows immediately
            const { code, sounds, currentIndex } = currentAudioSequence;
            if (currentIndex < sounds.length) {
                const soundFile = sounds[currentIndex];
                
                // Send to all windows
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    if (window && window.webContents && !window.isDestroyed()) {
                        try {
                            window.webContents.send('play-persistent-audio', { 
                                code, 
                                soundFile,
                                currentIndex,
                                totalSounds: sounds.length
                            });
                        } catch (error) {
                            console.error('Error sending restoration audio command:', error);
                        }
                    }
                });
            }
            
            return { success: true, restored: true, status: 'actively_playing' };
        }
        
        // Jika ada audio yang tersimpan untuk di-restore
        if (currentlyPlayingAudio && !isAudioPlaying) {
            console.log('[Audio] Restoring saved audio sequence:', currentlyPlayingAudio);
            
            // Restore audio sequence
            currentAudioSequence = { ...currentlyPlayingAudio };
            delete currentAudioSequence.timestamp;
            isAudioPlaying = true;
            
            // Continue playing from current position
            sendAudioToMainWindow();
            
            // Clear the saved state since we've restored it
            currentlyPlayingAudio = null;
            
            return { success: true, restored: true, status: 'restored_from_saved' };
        }
        
        console.log('[Audio] No audio to restore');
        return { success: true, restored: false, status: 'no_audio_to_restore' };
    } catch (error) {
        console.error('Error restoring audio:', error);
        return { success: false, error: error.message };
    }
});

// Handler untuk notifikasi bahwa audio element siap
ipcMain.handle('audio-element-ready', async () => {
    try {
        audioElementExists = true;
        console.log('[Audio] Audio element ready, checking for audio state...');
        
        // Delay sedikit untuk memastikan element benar-benar ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Jika ada audio yang sedang playing, kirim command sekarang
        if (isAudioPlaying && currentAudioSequence) {
            console.log('[Audio] Audio is playing, sending current command to newly ready element');
            
            const { code, sounds, currentIndex } = currentAudioSequence;
            if (currentIndex < sounds.length) {
                const soundFile = sounds[currentIndex];
                
                // Send to all windows
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    if (window && window.webContents && !window.isDestroyed()) {
                        try {
                            window.webContents.send('play-persistent-audio', { 
                                code, 
                                soundFile,
                                currentIndex,
                                totalSounds: sounds.length
                            });
                        } catch (error) {
                            console.error('Error sending audio to ready element:', error);
                        }
                    }
                });
            }
            
            return { success: true, status: 'sent_current_audio' };
        }
        
        // Jika ada audio yang harus di-restore, lakukan sekarang
        if (currentlyPlayingAudio && !isAudioPlaying) {
            console.log('[Audio] Auto-restoring audio after element ready');
            
            // Restore and continue
            currentAudioSequence = { ...currentlyPlayingAudio };
            delete currentAudioSequence.timestamp;
            isAudioPlaying = true;
            sendAudioToMainWindow();
            
            // Clear the saved state
            currentlyPlayingAudio = null;
            
            return { success: true, status: 'auto_restored' };
        }
        
        return { success: true, status: 'ready_no_audio' };
    } catch (error) {
        console.error('Error in audio-element-ready:', error);
        return { success: false, error: error.message };
    }
});

// IPC untuk mengirim masterData ke display window
ipcMain.handle('get-master-data', async () => {
    const config = loadConfig();
    return config.masterData || [];
});

// Kirim data serial ke main window (yang bisa berisi index.html atau display.html)
function sendSerialToWindows(data) {
    if (mainWindow) {
        mainWindow.webContents.send('serial-data', data);
    }
}

// IPC handler untuk update config dari display
ipcMain.handle('update-display-config', async (event, configData) => {
    try {
        const currentConfig = loadConfig();
        const updatedConfig = {
            ...currentConfig,
            displayConfig: {
                ...currentConfig.displayConfig,
                ...configData
            }
        };
        return saveConfig(updatedConfig);
    } catch (error) {
        console.error('Error updating display config:', error);
        return false;
    }
});

// IPC handler untuk mendapatkan display config
ipcMain.handle('get-display-config', async () => {
    try {
        const config = loadConfig();
        return config.displayConfig || {
            shapes: [],
            floorplanImg: '',
            blinkingSettings: {
                duration: 200,
                enabled: true
            }
        };
    } catch (error) {
        console.error('Error getting display config:', error);
        return null;
    }
});

// IPC handler untuk update call history (dari display.html atau index.html)
ipcMain.handle('update-call-history', async (event, data) => {
    try {
        console.log('📥 [MAIN] Received call history update from renderer:', {
            hasCallHistory: !!data.callHistory,
            callHistoryCount: data.callHistory?.length || 0,
            hasActiveAlerts: !!data.activeAlerts,
            activeAlertsCount: data.activeAlerts?.length || 0,
            hasPersistentSounds: !!data.persistentSounds,
            persistentSoundsCount: data.persistentSounds?.length || 0,
            hasPersistentBlinking: !!data.persistentBlinking,
            persistentBlinkingCount: data.persistentBlinking?.length || 0
        });
        
        if (data.callHistory) {
            sharedCallHistory = data.callHistory;
            
            // Save completed calls to persistent storage
            await saveCompletedCallsToPersistentStorage();
            console.log('📝 [MAIN] Updated call history:', sharedCallHistory.length, 'entries');
        }
        if (data.activeAlerts) {
            sharedActiveAlerts = data.activeAlerts;
            console.log('⚠️ [MAIN] Updated active alerts:', sharedActiveAlerts.length, 'alerts');
        }
        
        // Update persistent sounds dan blinking
        if (data.persistentSounds) {
            persistentSounds = new Map(data.persistentSounds);
            console.log('🔊 [MAIN] Updated persistent sounds:', persistentSounds.size, 'sounds');
        }
        if (data.persistentBlinking) {
            persistentBlinking = new Map(data.persistentBlinking);
            console.log('🔄 [MAIN] Updated persistent blinking:', persistentBlinking.size, 'shapes');
        }
        
        // Immediate broadcast ke semua window yang terbuka untuk sinkronisasi real-time
        broadcastCallHistoryUpdate();
        
        console.log('✅ [MAIN] Call history update completed and broadcasted');
        return true;
    } catch (error) {
        console.error('❌ [MAIN] Error updating call history:', error);
        return false;
    }
});

// Fungsi untuk menyimpan call history yang completed ke persistent storage
async function saveCompletedCallsToPersistentStorage() {
    try {
        const config = loadConfig();
        let persistentHistory = config.callHistoryStorage || [];
        
        // Ambil calls yang completed dari sharedCallHistory
        const completedCalls = sharedCallHistory.filter(call => call.status === 'completed');
        
        // Cek calls yang belum ada di persistent storage
        completedCalls.forEach(call => {
            const existsInPersistent = persistentHistory.find(persistent => 
                persistent.id === call.id || 
                (persistent.code === call.code && persistent.timestamp && call.timestamp && 
                 Math.abs(new Date(persistent.timestamp) - new Date(call.timestamp)) < 1000)
            );
            
            if (!existsInPersistent) {
                // Pastikan timestamp dalam format yang bisa di-serialize
                const persistentCall = {
                    ...call,
                    timestamp: call.timestamp ? new Date(call.timestamp).toISOString() : new Date().toISOString(),
                    resetTime: call.resetTime ? new Date(call.resetTime).toISOString() : null,
                    dateAdded: new Date().toISOString()
                };
                persistentHistory.push(persistentCall);
                console.log('📝 Saved completed call to persistent storage:', call.code);
            }
        });
        
        // Sort by timestamp descending (newest first)
        persistentHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Limit to last 10000 entries untuk avoid file terlalu besar
        if (persistentHistory.length > 10000) {
            persistentHistory = persistentHistory.slice(0, 10000);
        }
        
        // Save back to config
        const updatedConfig = {
            ...config,
            callHistoryStorage: persistentHistory
        };
        
        saveConfig(updatedConfig);
        console.log('💾 Persistent call history saved:', persistentHistory.length, 'total entries');
        
    } catch (error) {
        console.error('Error saving calls to persistent storage:', error);
    }
}

// IPC handler untuk force broadcast call history
ipcMain.handle('force-broadcast-call-history', async () => {
    try {
        broadcastCallHistoryUpdate();
        console.log('Forced broadcast call history update');
        return true;
    } catch (error) {
        console.error('Error in force broadcast:', error);
        return false;
    }
});

// Fungsi untuk broadcast call history update
function broadcastCallHistoryUpdate() {
    const updateData = {
        callHistory: sharedCallHistory,
        activeAlerts: sharedActiveAlerts,
        persistentSounds: Array.from(persistentSounds.entries()),
        persistentBlinking: Array.from(persistentBlinking.entries())
    };
    
    console.log('📡 [MAIN] Broadcasting call history update:', {
        callHistoryCount: updateData.callHistory.length,
        activeAlertsCount: updateData.activeAlerts.length,
        persistentSoundsCount: updateData.persistentSounds.length,
        persistentBlinkingCount: updateData.persistentBlinking.length
    });
    
    // Send to all windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window, index) => {
        if (window && window.webContents && !window.isDestroyed()) {
            try {
                window.webContents.send('call-history-updated', updateData);
                console.log(`📤 [MAIN] Sent update to window ${index + 1}`);
            } catch (error) {
                console.error(`❌ [MAIN] Error sending to window ${index + 1}:`, error);
            }
        }
    });
    
    // Fallback: also send to main window specifically
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('call-history-updated', updateData);
            console.log('📤 [MAIN] Sent update to main window (fallback)');
        } catch (error) {
            console.error('❌ [MAIN] Error sending to main window:', error);
        }
    }
}

// IPC handler untuk mendapatkan call history
ipcMain.handle('get-call-history', async () => {
    try {
        return {
            callHistory: sharedCallHistory,
            activeAlerts: sharedActiveAlerts,
            persistentSounds: Array.from(persistentSounds.entries()),
            persistentBlinking: Array.from(persistentBlinking.entries())
        };
    } catch (error) {
        console.error('Error getting call history:', error);
        return {
            callHistory: [],
            activeAlerts: [],
            persistentSounds: [],
            persistentBlinking: []
        };
    }
});

// IPC handler untuk mendapatkan persistent call history dengan filter tanggal
ipcMain.handle('get-persistent-call-history', async (event, options = {}) => {
    try {
        const config = loadConfig();
        let persistentHistory = config.callHistoryStorage || [];
        
        const { startDate, endDate } = options;
        
        if (startDate || endDate) {
            persistentHistory = persistentHistory.filter(call => {
                const callDate = new Date(call.timestamp);
                
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999); // Include full end date
                    return callDate >= start && callDate <= end;
                } else if (startDate) {
                    const start = new Date(startDate);
                    return callDate >= start;
                } else if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    return callDate <= end;
                }
                
                return true;
            });
        }
        
        console.log('📊 Retrieved persistent call history:', persistentHistory.length, 'entries', options.startDate ? `from ${options.startDate}` : '', options.endDate ? `to ${options.endDate}` : '');
        
        return persistentHistory;
    } catch (error) {
        console.error('Error getting persistent call history:', error);
        return [];
    }
});

// IPC handler untuk load persistent call history saat startup
ipcMain.handle('load-persistent-call-history-at-startup', async () => {
    try {
        const config = loadConfig();
        const persistentHistory = config.callHistoryStorage || [];
        
        // Load recent calls (last 100) untuk current session
        const recentCalls = persistentHistory.slice(0, 100).map(call => ({
            ...call,
            timestamp: new Date(call.timestamp),
            resetTime: call.resetTime ? new Date(call.resetTime) : null
        }));
        
        // Update shared call history dengan recent calls
        sharedCallHistory = recentCalls;
        
        console.log('🔄 Loaded persistent call history at startup:', recentCalls.length, 'recent entries');
        return recentCalls;
    } catch (error) {
        console.error('Error loading persistent call history at startup:', error);
        return [];
    }
});

