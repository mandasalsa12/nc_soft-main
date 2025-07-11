#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include "esp_wpa2.h"

// Konfigurasi WiFi Enterprise
const char* ssid = "TelU-Connect";
const char* username = "hipsterweeds";
const char* password = "10Jun2000.";

AsyncWebServer server(80);

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIMRS Hospital Management System</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: #667eea;
      --secondary-color: #764ba2;
      --success-color: #10b981;
      --danger-color: #ef4444;
      --warning-color: #f59e0b;
      --info-color: #3b82f6;
      --dark-color: #1f2937;
      --light-color: #f8fafc;
      --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
      --gradient-danger: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      --gradient-warning: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 1rem;
    }

    .main-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: var(--gradient-primary);
      border-radius: 20px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: var(--shadow-xl);
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 4s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }

    .header h1 {
      color: white;
      font-weight: 700;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      position: relative;
      z-index: 1;
    }

    .header p {
      color: rgba(255,255,255,0.9);
      font-size: 1.1rem;
      position: relative;
      z-index: 1;
    }

    .room-section {
      background: white;
      border-radius: 20px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: var(--shadow-lg);
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }

    .room-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--gradient-primary);
    }

    .room-title {
      color: var(--dark-color);
      font-weight: 600;
      font-size: 1.8rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .room-title i {
      color: var(--primary-color);
    }

    .button-card {
      background: white;
      border-radius: 16px;
      padding: 1rem;
      box-shadow: var(--shadow-md);
      border: 1px solid rgba(0,0,0,0.05);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      height: 100%;
    }

    .button-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-xl);
    }

    .action-btn {
      width: 100%;
      border: none;
      border-radius: 12px;
      padding: 1rem;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .action-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      transition: left 0.5s;
    }

    .action-btn:hover::before {
      left: 100%;
    }

    .action-btn:active {
      transform: scale(0.98);
    }

    .bed-btn {
      background: var(--gradient-primary);
      color: white;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .bed-btn:hover {
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
      transform: translateY(-2px);
    }

    .toilet-btn {
      background: var(--gradient-success);
      color: white;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }

    .toilet-btn:hover {
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.6);
      transform: translateY(-2px);
    }

    .emergency-btn {
      background: var(--gradient-danger);
      color: white;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
      animation: emergencyPulse 2s infinite;
    }

    .emergency-btn:hover {
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.6);
      transform: translateY(-2px);
      animation: none;
    }

    @keyframes emergencyPulse {
      0%, 100% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 4px 20px rgba(239, 68, 68, 0.7); }
    }

    .reset-btn {
      background: var(--gradient-warning);
      color: white;
      padding: 0.75rem;
      font-size: 0.9rem;
      box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
    }

    .reset-btn:hover {
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.5);
      transform: translateY(-1px);
    }

    .status-indicator {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--success-color);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
      animation: statusBlink 2s infinite;
    }

    @keyframes statusBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
    }

    .toast {
      background: white;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      margin-bottom: 0.5rem;
      box-shadow: var(--shadow-lg);
      border-left: 4px solid var(--success-color);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }

    .toast.show {
      transform: translateX(0);
    }

    @media (max-width: 768px) {
      .header h1 { font-size: 2rem; }
      .room-title { font-size: 1.5rem; }
      .action-btn { padding: 0.875rem; font-size: 0.95rem; }
      .button-card { padding: 0.75rem; }
      .room-section { padding: 1.5rem; }
    }

    @media (max-width: 576px) {
      body { padding: 0.5rem; }
      .header { padding: 1.5rem; }
      .header h1 { font-size: 1.75rem; }
      .room-section { padding: 1rem; }
      .action-btn { padding: 0.75rem; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-spinner"></div>
  </div>

  <div class="toast-container" id="toastContainer"></div>

  <div class="main-container">
    <div class="header">
      <h1><i class="fas fa-hospital"></i> SIMRS Hospital Management</h1>
      <p>Sistem Informasi Manajemen Rumah Sakit - Nurse Call System</p>
    </div>

    <div class="room-section">
      <h2 class="room-title">
        <i class="fas fa-bed"></i> Kamar 1
      </h2>
      <div class="row g-3">
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed1')">
              <i class="fas fa-bed"></i> Bed 1 (101)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset1')">
              <i class="fas fa-undo"></i> Reset Bed 1
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed2')">
              <i class="fas fa-bed"></i> Bed 2 (102)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset2')">
              <i class="fas fa-undo"></i> Reset Bed 2
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed3')">
              <i class="fas fa-bed"></i> Bed 3 (103)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset3')">
              <i class="fas fa-undo"></i> Reset Bed 3
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn toilet-btn" onclick="sendData('Toilet4')">
              <i class="fas fa-restroom"></i> Toilet (104)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset4')">
              <i class="fas fa-undo"></i> Reset Toilet
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn emergency-btn" onclick="sendData('CodeBlue5')">
              <i class="fas fa-exclamation-triangle"></i> Code Blue (105)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset5')">
              <i class="fas fa-undo"></i> Reset Code Blue
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="room-section">
      <h2 class="room-title">
        <i class="fas fa-bed"></i> Kamar 2
      </h2>
      <div class="row g-3">
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed6')">
              <i class="fas fa-bed"></i> Bed 1 (106)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset6')">
              <i class="fas fa-undo"></i> Reset Bed 1
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed7')">
              <i class="fas fa-bed"></i> Bed 2 (107)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset7')">
              <i class="fas fa-undo"></i> Reset Bed 2
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn bed-btn" onclick="sendData('Bed8')">
              <i class="fas fa-bed"></i> Bed 3 (108)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset8')">
              <i class="fas fa-undo"></i> Reset Bed 3
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn toilet-btn" onclick="sendData('Toilet9')">
              <i class="fas fa-restroom"></i> Toilet (109)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset9')">
              <i class="fas fa-undo"></i> Reset Toilet
            </button>
          </div>
        </div>
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="button-card">
            <div class="status-indicator"></div>
            <button class="action-btn emergency-btn" onclick="sendData('CodeBlue10')">
              <i class="fas fa-exclamation-triangle"></i> Code Blue (1010)
            </button>
            <button class="action-btn reset-btn" onclick="sendData('Reset10')">
              <i class="fas fa-undo"></i> Reset Code Blue
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function showToast(message, type = 'success') {
      const toastContainer = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
          <span>${message}</span>
        </div>
      `;
      
      toastContainer.appendChild(toast);
      
      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toastContainer.removeChild(toast), 300);
      }, 3000);
    }

    function showLoading() {
      document.getElementById('loadingOverlay').style.display = 'flex';
    }

    function hideLoading() {
      document.getElementById('loadingOverlay').style.display = 'none';
    }

    function sendData(action) {
      const btn = event.target;
      const originalOpacity = btn.style.opacity;
      
      btn.style.opacity = '0.7';
      btn.style.transform = 'scale(0.98)';
      
      showLoading();
      
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/" + action, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          hideLoading();
          btn.style.opacity = originalOpacity;
          btn.style.transform = '';
          
          if (xhr.status === 200) {
            showToast(`${action} berhasil dikirim!`);
          } else {
            showToast('Terjadi kesalahan!', 'error');
          }
        }
      };
      xhr.send();
    }

    // Auto-hide loading on page load
    window.addEventListener('load', function() {
      hideLoading();
    });

    // Add ripple effect
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('action-btn')) {
        const ripple = document.createElement('span');
        const rect = e.target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          background: rgba(255,255,255,0.5);
          border-radius: 50%;
          transform: scale(0);
          animation: ripple 0.6s linear;
          pointer-events: none;
        `;
        
        e.target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      }
    });

    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
      .action-btn {
        position: relative;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  </script>
</body>
</html>
)rawliteral";

void setup() {
  Serial.begin(9600);
  
  // Clear serial monitor
  for(int i = 0; i < 50; i++) {
    Serial.println();
  }
  
  Serial.println("Booting System ...");
  delay(1000);
  
  // Clear serial monitor again
  for(int i = 0; i < 50; i++) {
    Serial.println();
  }
  
  Serial.println("System Started");
  delay(500);
  
  // Konfigurasi WiFi Enterprise
  Serial.println("Configuring WiFi Enterprise...");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  
  // Konfigurasi WPA2 Enterprise
  esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)username, strlen(username));
  esp_wifi_sta_wpa2_ent_set_username((uint8_t *)username, strlen(username));
  esp_wifi_sta_wpa2_ent_set_password((uint8_t *)password, strlen(password));
  esp_wifi_sta_wpa2_ent_enable();
  
  // Koneksi ke WiFi
  Serial.println("Connecting to WiFi Enterprise...");
  WiFi.begin(ssid);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi Connected to ");
  Serial.println(ssid);
  Serial.print("Webserver on ");
  Serial.println(WiFi.localIP());

  // Route untuk halaman utama
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send_P(200, "text/html", index_html);
  });

  // Route untuk Kamar 1
  server.on("/Bed1", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("101");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset1", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("901");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed2", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("102");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset2", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("902");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed3", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("103");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset3", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("903");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Toilet4", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("104");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset4", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("904");
    request->send(200, "text/plain", "OK");
  });

  server.on("/CodeBlue5", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("105");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset5", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("905");
    request->send(200, "text/plain", "OK");
  });

  // Route untuk Kamar 2
  server.on("/Bed6", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("106");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset6", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("906");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed7", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("107");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset7", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("907");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed8", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("108");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset8", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("908");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Toilet9", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("109");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset9", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("909");
    request->send(200, "text/plain", "OK");
  });

  server.on("/CodeBlue10", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("1010");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset10", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("9010");
    request->send(200, "text/plain", "OK");
  });

  // Mulai server
  server.begin();
  Serial.println("Webserver ON");
}

void loop() {
  static unsigned long lastTime = 0;
  unsigned long currentTime = millis();

  if (currentTime - lastTime >= 1000) {
    lastTime = currentTime;
    Serial.println("(99)");
  }
}
