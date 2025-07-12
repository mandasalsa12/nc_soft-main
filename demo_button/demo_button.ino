#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

// Konfigurasi WiFi
const char* ssid = "Arie Squad";
const char* password = "Mangansate2022*";

AsyncWebServer server(80);

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">
  <title>ESP32 Button for SIMRS Development</title>
  <style>
    body {
      background-color: #f8f9fa;
      padding: 20px;
    }
    .container {
      background-color: white;
      border-radius: 15px;
      padding: 30px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
      margin-top: 20px;
    }
    h1 {
      color: #0d6efd;
      text-align: center;
      margin-bottom: 30px;
      font-weight: bold;
    }
    .btn {
      padding: 15px;
      font-size: 1.1em;
      margin-bottom: 15px;
      transition: all 0.3s;
      border-radius: 10px;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    .bed-button {
      background-color: #0d6efd;
      border: none;
    }
    .toilet-button {
      background-color: #198754;
      border: none;
    }
    .reset-button {
      background-color: #dc3545;
      border: none;
      padding: 8px;
      font-size: 0.9em;
    }
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .room-section {
      background-color: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .room-title {
      color: #0d6efd;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #dee2e6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ESP32 Button for SIMRS Development</h1>
    
    <div class="room-section">
      <h2 class="room-title">Kamar 1</h2>
      <div class="row">
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed1')">
              <i class="bi bi-person-bed"></i> Bed 1 (101)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset1')">
              Reset Bed 1
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed2')">
              <i class="bi bi-person-bed"></i> Bed 2 (102)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset2')">
              Reset Bed 2
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed3')">
              <i class="bi bi-person-bed"></i> Bed 3 (103)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset3')">
              Reset Bed 3
            </button>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed4')">
              <i class="bi bi-person-bed"></i> Bed 4 (104)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset4')">
              Reset Bed 4
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn toilet-button w-100" onclick="sendData('Toilet5')">
              <i class="bi bi-door-closed"></i> Toilet (105)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset5')">
              Reset Toilet
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="room-section">
      <h2 class="room-title">Kamar 2</h2>
      <div class="row">
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed6')">
              <i class="bi bi-person-bed"></i> Bed 1 (106)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset6')">
              Reset Bed 1
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed7')">
              <i class="bi bi-person-bed"></i> Bed 2 (107)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset7')">
              Reset Bed 2
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed8')">
              <i class="bi bi-person-bed"></i> Bed 3 (108)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset8')">
              Reset Bed 3
            </button>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn bed-button w-100" onclick="sendData('Bed9')">
              <i class="bi bi-person-bed"></i> Bed 4 (109)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset9')">
              Reset Bed 4
            </button>
          </div>
        </div>
        <div class="col-md-4 col-sm-6 mb-3">
          <div class="button-group">
            <button class="btn toilet-button w-100" onclick="sendData('Toilet10')">
              <i class="bi bi-door-closed"></i> Toilet (1010)
            </button>
            <button class="btn reset-button w-100" onclick="sendData('Reset10')">
              Reset Toilet
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function sendData(button) {
      var btn = event.target;
      btn.style.opacity = '0.7';
      
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/" + button, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          btn.style.opacity = '1';
        }
      };
      xhr.send();
    }
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
  
  // Koneksi ke WiFi
  Serial.println("Connecting WiFi ...");
  WiFi.begin(ssid, password);

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

  // Route untuk menangani tombol
  server.on("/Bed1", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("101");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed2", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("102");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed3", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("103");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed4", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("104");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Toilet5", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("105");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed6", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("106");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed7", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("107");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed8", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("108");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Bed9", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("109");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Toilet10", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("1010");
    request->send(200, "text/plain", "OK");
  });

  // Route untuk tombol reset
  server.on("/Reset1", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("901");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset2", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("902");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset3", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("903");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset4", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("904");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset5", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("905");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset6", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("906");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset7", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("907");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset8", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("908");
    request->send(200, "text/plain", "OK");
  });

  server.on("/Reset9", HTTP_GET, [](AsyncWebServerRequest *request){
    Serial.println("909");
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
    Serial.println("99");
  }
}
