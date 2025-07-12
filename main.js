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
        },
        fullscreen: true,
        frame: true
    });

    try {
        require('@electron/remote/main').enable(mainWindow.webContents);
    } catch (e) {
        console.error('Error enabling remote module:', e);
    }

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.setFullScreen(true);
    });
    
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
        
        // SECURITY FIX: Validate file size before reading
        const stats = fs.statSync(configPath);
        if (stats.size > 10 * 1024 * 1024) { // 10MB limit
            console.error('Config file too large, refusing to load:', stats.size);
            throw new Error('Config file exceeds size limit');
        }
        
        const data = fs.readFileSync(configPath, 'utf-8');
        
        // SECURITY FIX: Validate JSON structure before parsing
        if (!data.trim().startsWith('{') || !data.trim().endsWith('}')) {
            console.error('Invalid config file format');
            throw new Error('Invalid config file format');
        }
        
        const parsedData = JSON.parse(data);
        
        // SECURITY FIX: Validate required properties and structure
        if (typeof parsedData !== 'object' || parsedData === null) {
            throw new Error('Config must be an object');
        }
        
        // Validate and sanitize masterData
        if (parsedData.masterData && Array.isArray(parsedData.masterData)) {
            parsedData.masterData = parsedData.masterData.filter(item => {
                return typeof item === 'object' && item !== null && typeof item.charCode === 'string';
            }).slice(0, 1000); // Limit array size
        }
        
        // Validate and sanitize callHistoryStorage
        if (parsedData.callHistoryStorage && Array.isArray(parsedData.callHistoryStorage)) {
            parsedData.callHistoryStorage = parsedData.callHistoryStorage.filter(item => {
                return typeof item === 'object' && item !== null && typeof item.code === 'string';
            }).slice(0, 10000); // Limit array size
        }
        
        // Ensure callHistoryStorage exists
        if (!parsedData.callHistoryStorage) {
            parsedData.callHistoryStorage = [];
        }
        
        console.log('Config loaded and validated successfully');
        return parsedData;
    } catch (error) {
        console.error('Error loading config:', error);
        // Return safe default config on error
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

app.whenReady().then(async () => {
    // Additional setup to suppress warnings
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    
    console.log('🚀 [MAIN] Application starting up...');
    
    // CRITICAL: Initialize persistent call history FIRST before creating windows
    const historyLoaded = await initializePersistentCallHistory();
    
    if (historyLoaded) {
        console.log('✅ [MAIN] Startup with persistent call history loaded');
    } else {
        console.log('🆕 [MAIN] Startup with fresh session (no persistent history)');
    }
    
    createMainWindow();
    
    console.log('🖥️ [MAIN] Main window created, application ready');
    
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
    
    // CRITICAL: Validate that this callback is for the currently playing sequence
    if (!currentAudioSequence || currentAudioSequence.code !== code || !isAudioPlaying) {
        console.log('🚫 [MAIN] Ignoring stale audio ended callback for code:', code, 'current sequence:', currentAudioSequence?.code, 'isPlaying:', isAudioPlaying);
        return;
    }
    
    // CRITICAL: Validate current index to prevent duplicate callbacks
    if (currentIndex !== currentAudioSequence.currentIndex) {
        console.log('🚫 [MAIN] Ignoring out-of-sync audio ended callback - expected index:', currentAudioSequence.currentIndex, 'got:', currentIndex);
        return;
    }
    
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
            
            console.log(`🔄 Completed loop ${currentAudioSequence.loopCount} for code: ${code} - waiting 3 seconds before next loop`);
            
            // Clear any existing delay timeout
            if (loopDelayTimeout) {
                clearTimeout(loopDelayTimeout);
            }
            
            // Set delay before starting next loop
            loopDelayTimeout = setTimeout(() => {
                // Check if still should be playing (not reset)
                if (isAudioPlaying && currentAudioSequence && currentAudioSequence.code === code) {
                    console.log(`🔁 Starting loop ${currentAudioSequence.loopCount + 1} for code: ${code}`);
                    sendAudioToAllWindows();
                } else {
                    console.log(`⏹️ Audio sequence stopped during delay for code: ${code}`);
                }
                loopDelayTimeout = null;
            }, 3000); // 3 second delay
        } else {
            // Continue to next sound in current sequence
            console.log(`▶️ Playing sound ${currentAudioSequence.currentIndex + 1}/${currentAudioSequence.sounds.length} for code: ${code}`);
            sendAudioToAllWindows();
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

// ENHANCED: Load persistent call history into shared state at startup
async function initializePersistentCallHistory() {
    try {
        console.log('🚀 [MAIN] Initializing persistent call history at startup...');
        const config = loadConfig();
        const persistentHistory = config.callHistoryStorage || [];
        
        if (persistentHistory.length > 0) {
            // Load all persistent calls into shared state (convert ISO strings back to Date objects)
            const allPersistentCalls = persistentHistory.map(call => ({
                ...call,
                timestamp: new Date(call.timestamp),
                resetTime: call.resetTime ? new Date(call.resetTime) : null
            }));
            
            // Set shared call history dengan semua data persisten
            sharedCallHistory = allPersistentCalls;
            
            // Clear active alerts untuk startup (hanya completed calls yang dimuat)
            sharedActiveAlerts = [];
            
            console.log(`✅ [MAIN] Loaded ${allPersistentCalls.length} persistent calls into shared state`);
            console.log(`📋 [MAIN] Call history ready with date range:`, {
                oldest: allPersistentCalls.length > 0 ? allPersistentCalls[allPersistentCalls.length - 1].time : 'none',
                newest: allPersistentCalls.length > 0 ? allPersistentCalls[0].time : 'none'
            });
            
            return true;
        } else {
            console.log('📭 [MAIN] No persistent call history found - starting fresh');
            sharedCallHistory = [];
            sharedActiveAlerts = [];
            return false;
        }
    } catch (error) {
        console.error('❌ [MAIN] Error initializing persistent call history:', error);
        sharedCallHistory = [];
        sharedActiveAlerts = [];
        return false;
    }
}

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

        // Create parser for reading data with optimized settings
        const parser = new ReadlineParser({ 
            delimiter: '\r\n',
            includeDelimiter: false
        });
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

                // OPTIMIZED: Direct processing without unnecessary async operations
                parser.on('data', (data) => {
                    try {
                        const cleanData = data.toString().trim();
                        if (cleanData) { // Only process non-empty data
                            console.log('📥 [SERIAL] Received:', cleanData);
                            
                            // CRITICAL: Process immediately without additional delay
                            setImmediate(() => {
                                sendSerialToWindows(cleanData);
                            });
                        }
                    } catch (error) {
                        console.error('❌ [SERIAL] Error processing received data:', error);
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
        console.log('🚀 [MAIN] Starting persistent looping audio sequence for code:', code, 'with', sounds.length, 'sounds');
        
        // CRITICAL: Stop existing sound jika ada YANG BERBEDA CODE
        if (isAudioPlaying && currentAudioSequence && currentAudioSequence.code !== code) {
            console.log('🛑 [MAIN] Stopping existing audio sequence for different code:', currentAudioSequence.code);
            stopCurrentAudio();
        }
        
        // Jika sudah ada audio untuk code yang sama dan masih playing, skip
        if (isAudioPlaying && currentAudioSequence && currentAudioSequence.code === code) {
            console.log('⚠️ [MAIN] Audio for code', code, 'is already playing, continuing existing sequence...');
            return { success: true, message: 'Already playing' };
        }
        
        // CRITICAL: Set persistent sound state BEFORE starting audio
        persistentSounds.set(code, {
            sounds: sounds,
            isPlaying: true,
            startTime: Date.now(),
            currentIndex: 0,
            isLooping: true // Flag untuk menandakan ini adalah looping sequence
        });
        
        // Start audio sequence - akan loop terus dengan delay 3 detik antar loop
        currentAudioSequence = { code, sounds, currentIndex: 0, loopCount: 1 };
        isAudioPlaying = true;
        
        // Send audio command directly to all windows
        sendAudioToAllWindows();
        
        console.log(`🚀 [MAIN] Audio looping sequence started for code: ${code}`);
        console.log(`📝 [MAIN] Sequence details: ${sounds.length} sounds, will loop continuously with 3-second delay between loops`);
        console.log(`🛑 [MAIN] To stop this sequence, send reset code: 90${code.substring(2)}`);
        console.log(`💾 [MAIN] Persistent sound state saved for code: ${code}`);
        return { success: true };
    } catch (error) {
        console.error('❌ [MAIN] Error playing persistent sounds:', error);
        return { success: false, error: error.message };
    }
});

// Handler untuk stop persistent sounds - ENHANCED FOR IMMEDIATE RESET
ipcMain.handle('stop-persistent-sounds', async (event, { code }) => {
    try {
        // ENHANCED: Log detailed state before stopping
        const soundData = persistentSounds.get(code);
        const currentLoop = currentAudioSequence?.loopCount || 1;
        
        console.log(`🛑 [MAIN] IMMEDIATE STOP REQUEST for persistent audio code: ${code}`);
        console.log(`📊 [MAIN] Audio state before stop:`, {
            hasPersistentSound: persistentSounds.has(code),
            currentSequenceCode: currentAudioSequence?.code,
            isAudioPlaying: isAudioPlaying,
            currentlyPlayingAudioCode: currentlyPlayingAudio?.code,
            loopCount: currentLoop
        });
        
        let wasRemoved = false;
        
        // CRITICAL: Remove from persistent sounds FIRST
        if (persistentSounds.has(code)) {
            persistentSounds.delete(code);
            wasRemoved = true;
            console.log(`🗑️ [MAIN] Removed from persistent sounds: ${code}`);
        }
        
        // CRITICAL: Stop audio IMMEDIATELY if it matches the code
        if (currentAudioSequence && currentAudioSequence.code === code) {
            console.log(`🛑 [MAIN] Stopping current audio sequence IMMEDIATELY for code: ${code}`);
            stopCurrentAudio();
        } else {
            console.log(`ℹ️ [MAIN] Audio sequence code mismatch - current: ${currentAudioSequence?.code}, requested: ${code}`);
        }
        
        // CRITICAL: Also clear currentlyPlayingAudio if it matches the code being stopped
        if (currentlyPlayingAudio && currentlyPlayingAudio.code === code) {
            console.log(`🗑️ [MAIN] Clearing currentlyPlayingAudio for stopped code: ${code}`);
            currentlyPlayingAudio = null;
        }
        
        // CRITICAL: Broadcast IMMEDIATE stop to all windows
        broadcastToAllWindows('persistent-sound-stopped', { code });
        
        console.log(`✅ [MAIN] IMMEDIATE STOP completed for code: ${code}, wasRemoved: ${wasRemoved}`);
        return { success: true, wasRemoved: wasRemoved, immediate: true };
    } catch (error) {
        console.error('❌ [MAIN] Error stopping persistent sounds:', error);
        return { success: false, error: error.message };
    }
});

// OPTIMIZED: Cache for file existence checks
const audioFileCache = new Map();

// Function to send audio command to all windows - OPTIMIZED VERSION
function sendAudioToAllWindows() {
    if (!currentAudioSequence || !isAudioPlaying) {
        return;
    }
    
    const { code, sounds, currentIndex } = currentAudioSequence;
    
    // OPTIMIZED: Early return for invalid index
    if (currentIndex >= sounds.length) {
        return;
    }
    
    const soundFile = sounds[currentIndex];
    const soundPath = getSoundsPath();
    const fullPath = path.join(soundPath, soundFile);
    
    // OPTIMIZED: Use cached file existence check
    const cacheKey = fullPath;
    let fileExists = audioFileCache.get(cacheKey);
    
    if (fileExists === undefined) {
        fileExists = fs.existsSync(fullPath);
        audioFileCache.set(cacheKey, fileExists);
    }
    
    if (!fileExists) {
        console.error('❌ [AUDIO] File not found:', soundFile);
        // Skip to next sound
        currentAudioSequence.currentIndex = currentIndex + 1;
        setImmediate(() => sendAudioToAllWindows());
        return;
    }
    
    const currentLoop = currentAudioSequence.loopCount || 1;
    console.log(`⚡ [AUDIO] Playing: ${soundFile} (${currentIndex + 1}/${sounds.length}) Loop: ${currentLoop}`);
    
    const audioCommand = { 
        code, 
        soundFile,
        currentIndex,
        totalSounds: sounds.length,
        fullPath: fullPath
    };
    
    // OPTIMIZED: Non-blocking broadcast
    setImmediate(() => {
        broadcastToAllWindows('play-persistent-audio', audioCommand);
    });
}

// OPTIMIZED: Function to broadcast to all windows with faster execution
function broadcastToAllWindows(eventName, data) {
    const windows = BrowserWindow.getAllWindows();
    let sentCount = 0;
    
    // OPTIMIZED: Process all windows in parallel using Promise.allSettled
    const broadcasts = windows.map((window, index) => {
        if (window && window.webContents && !window.isDestroyed()) {
            try {
                window.webContents.send(eventName, data);
                sentCount++;
                return Promise.resolve(index);
            } catch (error) {
                console.error(`❌ Broadcast error window ${index + 1}:`, error.message);
                return Promise.reject(error);
            }
        }
        return Promise.resolve(null);
    });
    
    // OPTIMIZED: Log only summary for better performance
    console.log(`⚡ [BROADCAST] ${eventName} → ${sentCount} windows`);
    
    // OPTIMIZED: Ensure main window gets message without duplicate check
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed() && !windows.includes(mainWindow)) {
        try {
            mainWindow.webContents.send(eventName, data);
        } catch (error) {
            console.error('❌ Main window broadcast error:', error.message);
        }
    }
}

// Function to send audio command to main window - DEPRECATED, use sendAudioToAllWindows
function sendAudioToMainWindow() {
    sendAudioToAllWindows();
}

// Function to stop current audio - ENHANCED VERSION FOR IMMEDIATE RESET
function stopCurrentAudio() {
    console.log('🛑 [MAIN] IMMEDIATE STOP: Stopping current audio sequence and any pending loops');
    
    // CRITICAL: Set flags immediately to prevent any new audio commands
    isAudioPlaying = false;
    currentAudioSequence = null;
    
    // CRITICAL: Clear currentlyPlayingAudio to prevent restoration of stopped audio
    currentlyPlayingAudio = null;
    console.log('🗑️ [MAIN] Cleared currentlyPlayingAudio to prevent restoration after stop');
    
    // CRITICAL: Clear ALL audio-related timeouts immediately
    if (globalAudioPlayer) {
        clearTimeout(globalAudioPlayer);
        globalAudioPlayer = null;
        console.log('🗑️ [MAIN] Cleared global audio player timeout');
    }
    
    // CRITICAL: Clear loop delay timeout to prevent next loop from starting
    if (loopDelayTimeout) {
        clearTimeout(loopDelayTimeout);
        loopDelayTimeout = null;
        console.log('🗑️ [MAIN] Cleared pending loop delay timeout');
    }
    
    // CRITICAL: Send IMMEDIATE stop command to all windows
    broadcastToAllWindows('stop-persistent-audio', {});
    console.log('📡 [MAIN] Sent immediate stop command to all windows');
}

// Handler untuk callback dari renderer ketika audio selesai
ipcMain.handle('audio-ended', async (event, { code, currentIndex }) => {
    try {
        console.log('Audio ended callback for code:', code, 'index:', currentIndex);
        
        // Update current audio sequence
        if (currentAudioSequence && currentAudioSequence.code === code && isAudioPlaying) {
            currentAudioSequence.currentIndex = currentIndex + 1;
            
            // Continue to next sound
            sendAudioToAllWindows();
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
        
        // CRITICAL: Jika ada audio yang tersimpan untuk di-restore, VALIDASI dulu
        if (currentlyPlayingAudio && !isAudioPlaying) {
            console.log('[Audio] Found saved audio, validating if it should be restored...');
            
            // Cek apakah audio code masih ada di persistent sounds (belum di-reset)
            const audioCode = currentlyPlayingAudio.code;
            const stillPersistent = persistentSounds.has(audioCode);
            
            console.log(`[Audio] Audio validation - Code: ${audioCode}, Still persistent: ${stillPersistent}`);
            
            if (stillPersistent) {
                console.log('[Audio] Audio is still valid, restoring saved audio sequence:', currentlyPlayingAudio);
                
                // Restore audio sequence
                currentAudioSequence = { ...currentlyPlayingAudio };
                delete currentAudioSequence.timestamp;
                isAudioPlaying = true;
                
                // Continue playing from current position
                sendAudioToAllWindows();
                
                // Clear the saved state since we've restored it
                currentlyPlayingAudio = null;
                
                return { success: true, restored: true, status: 'restored_from_saved' };
            } else {
                console.log('[Audio] Audio code no longer persistent (was reset), clearing saved state');
                // Clear saved state since audio was reset
                currentlyPlayingAudio = null;
                return { success: true, restored: false, status: 'audio_was_reset' };
            }
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
        
        // Jika ada audio yang harus di-restore, lakukan sekarang dengan validasi
        if (currentlyPlayingAudio && !isAudioPlaying) {
            console.log('[Audio] Auto-restoring audio after element ready, validating...');
            
            // CRITICAL: Validate if audio should still be restored
            const audioCode = currentlyPlayingAudio.code;
            const stillPersistent = persistentSounds.has(audioCode);
            
            console.log(`[Audio] Auto-restore validation - Code: ${audioCode}, Still persistent: ${stillPersistent}`);
            
            if (stillPersistent) {
                // Restore and continue
                currentAudioSequence = { ...currentlyPlayingAudio };
                delete currentAudioSequence.timestamp;
                isAudioPlaying = true;
                sendAudioToAllWindows();
                
                // Clear the saved state
                currentlyPlayingAudio = null;
                
                console.log('[Audio] Auto-restored valid audio sequence');
                return { success: true, status: 'auto_restored' };
            } else {
                console.log('[Audio] Audio was reset during element ready, clearing saved state');
                currentlyPlayingAudio = null;
                return { success: true, status: 'auto_restore_audio_was_reset' };
            }
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

// OPTIMIZED: Pre-compiled regex patterns for better performance
const VALID_SERIAL_PATTERNS = [
    /^(10|90)\d{1,2}$/, // 10x, 90x, 10xx, 90xx format
    /^(99|100)$/, // standby codes
    /^(10|90)\d{1,2}:$/, // with colon suffix
    /^99:$/ // 99: standby code with colon
];

const SANITIZE_REGEX = /[^a-zA-Z0-9:]/g;

// Kirim data serial ke main window (yang bisa berisi index.html atau display.html) - OPTIMIZED
function sendSerialToWindows(data) {
    // OPTIMIZED: Fast validation and early return
    if (!data || typeof data !== 'string' || data.length === 0) {
        return;
    }
    
    // OPTIMIZED: Single regex operation for sanitization
    const sanitizedData = data.replace(SANITIZE_REGEX, '').trim();
    
    if (!sanitizedData) {
        return;
    }
    
    // OPTIMIZED: Fast format validation using pre-compiled regex
    const isValidFormat = VALID_SERIAL_PATTERNS.some(pattern => pattern.test(sanitizedData));
    
    if (!isValidFormat) {
        console.warn('❌ [SERIAL] Invalid format:', data, '→', sanitizedData);
        return;
    }
    
    // OPTIMIZED: Fast data normalization
    const processedData = sanitizedData.endsWith(':') ? 
        sanitizedData.slice(0, -1) : 
        sanitizedData;
    
    // OPTIMIZED: Length check with early truncation
    const finalData = processedData.length > 10 ? 
        processedData.substring(0, 10) : 
        processedData;
    
    console.log('⚡ [SERIAL] Processing:', finalData);
    
    // CRITICAL: Handle reset codes immediately in main process for faster response
    if (finalData.startsWith('90')) {
        const targetCode = '10' + finalData.substring(2);
        console.log('⚡ [SERIAL] IMMEDIATE RESET:', targetCode);
        
        // OPTIMIZED: Batch operations for faster execution
        let operationsPerformed = 0;
        
        // Stop audio immediately in main process
        if (currentAudioSequence && currentAudioSequence.code === targetCode) {
            stopCurrentAudio();
            operationsPerformed++;
        }
        
        // Remove from persistent sounds immediately
        if (persistentSounds.has(targetCode)) {
            persistentSounds.delete(targetCode);
            operationsPerformed++;
        }
        
        // Clear currentlyPlayingAudio if it matches
        if (currentlyPlayingAudio && currentlyPlayingAudio.code === targetCode) {
            currentlyPlayingAudio = null;
            operationsPerformed++;
        }
        
        // OPTIMIZED: Only broadcast if operations were performed
        if (operationsPerformed > 0) {
            // Use setImmediate for non-blocking broadcast
            setImmediate(() => {
                broadcastToAllWindows('persistent-sound-stopped', { code: targetCode });
            });
        }
        
        console.log(`⚡ [SERIAL] Reset operations: ${operationsPerformed}`);
         }
     
     // OPTIMIZED: Send to windows immediately without blocking
     if (mainWindow && !mainWindow.isDestroyed()) {
         setImmediate(() => {
             mainWindow.webContents.send('serial-data', finalData);
         });
         console.log('📤 [SERIAL] Queued to windows:', finalData);
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
            
            // ENHANCED: Save ALL calls to persistent storage immediately
            const saveResult = await saveCompletedCallsToPersistentStorage();
            if (saveResult) {
                console.log('📝 [MAIN] Updated and saved call history:', sharedCallHistory.length, 'entries');
            } else {
                console.warn('⚠️ [MAIN] Call history updated but save failed');
            }
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

// ENHANCED: Save ALL call history (both active and completed) to persistent storage
async function saveCompletedCallsToPersistentStorage() {
    try {
        const config = loadConfig();
        let persistentHistory = config.callHistoryStorage || [];
        
        // IMPROVED: Save ALL calls from sharedCallHistory, not just completed ones
        const allCalls = sharedCallHistory || [];
        
        console.log('💾 [MAIN] Saving call history to persistent storage:', allCalls.length, 'calls');
        
        // Cek calls yang belum ada di persistent storage
        allCalls.forEach(call => {
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
                console.log('📝 [MAIN] Saved call to persistent storage:', call.code, '(' + call.status + ')');
            } else {
                // ENHANCED: Update existing call if status changed (e.g., active -> completed)
                const existingIndex = persistentHistory.findIndex(persistent => 
                    persistent.id === call.id || 
                    (persistent.code === call.code && persistent.timestamp && call.timestamp && 
                     Math.abs(new Date(persistent.timestamp) - new Date(call.timestamp)) < 1000)
                );
                
                if (existingIndex !== -1) {
                    const existingCall = persistentHistory[existingIndex];
                    if (existingCall.status !== call.status || 
                        (call.resetTime && !existingCall.resetTime)) {
                        // Update existing call with new status/reset time
                        persistentHistory[existingIndex] = {
                            ...existingCall,
                            ...call,
                            timestamp: call.timestamp ? new Date(call.timestamp).toISOString() : existingCall.timestamp,
                            resetTime: call.resetTime ? new Date(call.resetTime).toISOString() : existingCall.resetTime,
                            dateModified: new Date().toISOString()
                        };
                        console.log('🔄 [MAIN] Updated call in persistent storage:', call.code, '(' + call.status + ')');
                    }
                }
            }
        });
        
        // Sort by timestamp descending (newest first)
        persistentHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Limit to last 10000 entries untuk avoid file terlalu besar
        if (persistentHistory.length > 10000) {
            const removedCount = persistentHistory.length - 10000;
            persistentHistory = persistentHistory.slice(0, 10000);
            console.log('🗑️ [MAIN] Trimmed', removedCount, 'oldest entries to maintain limit');
        }
        
        // Save back to config
        const updatedConfig = {
            ...config,
            callHistoryStorage: persistentHistory
        };
        
        const saveResult = saveConfig(updatedConfig);
        if (saveResult) {
            console.log('✅ [MAIN] Persistent call history saved successfully:', persistentHistory.length, 'total entries');
        } else {
            console.error('❌ [MAIN] Failed to save persistent call history');
        }
        
        return saveResult;
        
    } catch (error) {
        console.error('❌ [MAIN] Error saving calls to persistent storage:', error);
        return false;
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
        // ENHANCED: Ensure data is properly formatted and up-to-date
        const formattedCallHistory = sharedCallHistory.map(call => ({
            ...call,
            // Ensure timestamps are Date objects for frontend compatibility
            timestamp: call.timestamp instanceof Date ? call.timestamp : new Date(call.timestamp),
            resetTime: call.resetTime ? (call.resetTime instanceof Date ? call.resetTime : new Date(call.resetTime)) : null
        }));
        
        console.log('📤 [MAIN] Providing call history:', {
            callHistoryCount: formattedCallHistory.length,
            activeAlertsCount: sharedActiveAlerts.length,
            persistentSoundsCount: persistentSounds.size,
            persistentBlinkingCount: persistentBlinking.size
        });
        
        return {
            callHistory: formattedCallHistory,
            activeAlerts: sharedActiveAlerts,
            persistentSounds: Array.from(persistentSounds.entries()),
            persistentBlinking: Array.from(persistentBlinking.entries())
        };
    } catch (error) {
        console.error('❌ [MAIN] Error getting call history:', error);
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
        // IMPROVED: Return already loaded shared call history instead of re-loading
        console.log('📤 [MAIN] Providing pre-loaded call history to renderer:', sharedCallHistory.length, 'entries');
        
        // Ensure data is in the correct format for frontend
        const formattedHistory = sharedCallHistory.map(call => ({
            ...call,
            // Ensure timestamps are Date objects (might be ISO strings from storage)
            timestamp: call.timestamp instanceof Date ? call.timestamp : new Date(call.timestamp),
            resetTime: call.resetTime ? (call.resetTime instanceof Date ? call.resetTime : new Date(call.resetTime)) : null
        }));
        
        console.log('✅ [MAIN] Sent formatted call history to frontend:', formattedHistory.length, 'entries');
        
        return formattedHistory;
    } catch (error) {
        console.error('❌ [MAIN] Error providing call history at startup:', error);
        return [];
    }
});

// IPC handler for saving notification settings and broadcasting changes
ipcMain.handle('save-notification-settings', async (event, settings) => {
    try {
        const config = loadConfig();
        const result = saveConfig({
            ...config,
            notificationSettings: settings
        });

        if (result) {
            // Broadcast notification settings update to all windows
            broadcastToAllWindows('notification-settings-updated', settings);
            console.log('Notification settings saved and broadcasted:', settings);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving notification settings:', error);
        return false;
    }
});

// OPTIMIZED: Pre-defined test cases for faster access
const TEST_CASES = [
    '99',     // standby
    '99:',    // standby with colon
    '100',    // exit standby
    '101',    // call code
    '101:',   // call code with colon
    '102:',   // another call code with colon
    '901',    // reset code
    '901:',   // reset code with colon
    '1010',   // two digit call
    '9010:',  // two digit reset with colon
    'invalid', // invalid data
    '999',    // invalid range
    '10101',  // too long
];

// Handler untuk test serial parsing - OPTIMIZED for faster response
ipcMain.handle('test-serial-parsing', async (event, testData) => {
    try {
        console.log('⚡ [TEST] Testing:', testData || 'all cases');
        
        if (testData) {
            // OPTIMIZED: Immediate processing for single test
            setImmediate(() => {
                sendSerialToWindows(testData);
            });
            console.log('⚡ [TEST] Queued:', testData);
            return { success: true, processed: 1 };
        } else {
            // OPTIMIZED: Faster batch testing with reduced delays
            console.log('⚡ [TEST] Running batch tests...');
            let processedCount = 0;
            
            TEST_CASES.forEach((testCase, index) => {
                // OPTIMIZED: Reduced delay from 1000ms to 100ms for faster testing
                setTimeout(() => {
                    console.log(`⚡ [TEST] ${index + 1}/${TEST_CASES.length}: "${testCase}"`);
                    sendSerialToWindows(testCase);
                    processedCount++;
                }, index * 100); // 100ms delay instead of 1000ms
            });
            
            return { success: true, processed: TEST_CASES.length };
        }
    } catch (error) {
        console.error('❌ [TEST] Error:', error);
        return { success: false, error: error.message };
    }
});

// Handler untuk exit application
ipcMain.handle('exit-application', async () => {
    try {
        // ENHANCED: Final save of all data before exit
        console.log('💾 [MAIN] Performing final save before exit...');
        
        // Save call history first (most important)
        const historySaveResult = await saveCompletedCallsToPersistentStorage();
        if (historySaveResult) {
            console.log('✅ [MAIN] Call history saved successfully before exit');
        } else {
            console.error('❌ [MAIN] Failed to save call history before exit');
        }
        
        // Save config
        const config = loadConfig();
        const configSaveResult = saveConfig(config);
        if (configSaveResult) {
            console.log('✅ [MAIN] Configuration saved successfully before exit');
        } else {
            console.error('❌ [MAIN] Failed to save configuration before exit');
        }
        
        // Stop all audio
        if (sharedAudioWindow) {
            sharedAudioWindow.webContents.send('stop-shared-audio');
        }
        
        // Disconnect serial port jika masih terhubung
        if (serialPort && serialPort.isOpen) {
            try {
                await new Promise((resolve, reject) => {
                    serialPort.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                console.log('Serial port disconnected before exit');
            } catch (error) {
                console.error('Error disconnecting serial port:', error);
            }
        }
        
        // Force close all windows
        BrowserWindow.getAllWindows().forEach(window => {
            if (!window.isDestroyed()) {
                window.destroy();
            }
        });
        
        // Kill the entire process
        process.exit(0);
        return true;
    } catch (error) {
        console.error('Error during exit:', error);
        return false;
    }
});


