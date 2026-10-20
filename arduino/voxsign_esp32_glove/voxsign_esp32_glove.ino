/*
 * =====================================================================
 *  VoxSign ESP32 Smart Glove Firmware (Zero Calibration)
 *  
 *  - NO MANUAL CALIBRATION NEEDED:
 *    Automatically captures the natural resting baseline of each finger
 *    at startup (setup). No manual threshold calibration or numbers needed!
 *  - Works instantly with any flex sensor readings (e.g., 473, 2758).
 *  - Sends alerts directly to Supabase Cloud PostgREST RPC (No 405 error).
 * =====================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// =====================================================================
// 1. WiFi & Cloud Configuration
// =====================================================================
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase PostgREST Cloud Endpoint
const char* SUPABASE_RPC_URL  = "https://thpjccuzjyjtryvgcjmp.supabase.co/rest/v1/rpc/submit_device_gesture";
const char* SUPABASE_ANON_KEY = "sb_publishable_F9sfFPCQHDdSMa27udqxOw_8O0rv61E";

// Copy from: https://sakthi-g2005.github.io/voxsign/profile
const char* DEVICE_KEY = "YOUR_DEVICE_KEY_FROM_PROFILE";

// =====================================================================
// 2. Flex Sensor Pins (ADC1)
// =====================================================================
const int PIN_FLEX_THUMB  = 36; // Thumb  (GPIO 36 / VP)
const int PIN_FLEX_INDEX  = 34; // Flex 2 (GPIO 34)
const int PIN_FLEX_MIDDLE = 35; // Flex 3 (GPIO 35)
const int PIN_FLEX_RING   = 32; // Flex 4 (GPIO 32)
const int PIN_FLEX_PINKY  = 33; // Flex 5 (GPIO 33)

// =====================================================================
// 3. Auto-Baseline (Zero Calibration)
// =====================================================================
// Automatically established at boot. No manual calibration numbers!
int baseThumb  = 0;
int baseIndex  = 0;
int baseMiddle = 0;
int baseRing   = 0;
int basePinky  = 0;

// Deflection threshold relative to resting state (no manual calibration needed)
const int BEND_DELTA = 350;

// Debounce / Cooldown between alerts (3 seconds)
unsigned long lastSendTime = 0;
const unsigned long SEND_COOLDOWN_MS = 3000;

// Function declarations
void connectWiFi();
void sendGestureToSupabase(String code, String message, int f1, int f2, int f3, int f4, int f5);

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================================");
  Serial.println("   VoxSign ESP32 Glove (Zero Calibration)    ");
  Serial.println("=============================================");

  analogReadResolution(12);

  // Auto-establish baseline resting values (Takes ~0.8s)
  Serial.println("[Auto-Baseline] Measuring resting hand position...");
  long sumThumb = 0, sumIndex = 0, sumMiddle = 0, sumRing = 0, sumPinky = 0;
  for (int i = 0; i < 15; i++) {
    sumThumb  += analogRead(PIN_FLEX_THUMB);
    sumIndex  += analogRead(PIN_FLEX_INDEX);
    sumMiddle += analogRead(PIN_FLEX_MIDDLE);
    sumRing   += analogRead(PIN_FLEX_RING);
    sumPinky  += analogRead(PIN_FLEX_PINKY);
    delay(50);
  }
  baseThumb  = sumThumb / 15;
  baseIndex  = sumIndex / 15;
  baseMiddle = sumMiddle / 15;
  baseRing   = sumRing / 15;
  basePinky  = sumPinky / 15;

  Serial.printf("[Auto-Baseline] Resting Base: Flex2(34)=%d | Flex3(35)=%d | Thumb=%d\n",
                baseIndex, baseMiddle, baseThumb);
  Serial.println("[Auto-Baseline] Ready! Zero calibration required.");

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Read live sensor values
  int valThumb  = analogRead(PIN_FLEX_THUMB);
  int valIndex  = analogRead(PIN_FLEX_INDEX);   // GPIO 34
  int valMiddle = analogRead(PIN_FLEX_MIDDLE);  // GPIO 35
  int valRing   = analogRead(PIN_FLEX_RING);
  int valPinky  = analogRead(PIN_FLEX_PINKY);

  // Dynamic bend detection: checks relative change from resting baseline
  bool indexBent  = abs(valIndex  - baseIndex)  > BEND_DELTA;
  bool middleBent = abs(valMiddle - baseMiddle) > BEND_DELTA;
  bool thumbBent  = abs(valThumb  - baseThumb)  > BEND_DELTA;

  Serial.printf("Flex2(34): %4d (Δ%3d%s) | Flex3(35): %4d (Δ%3d%s)\n",
                valIndex, abs(valIndex - baseIndex), indexBent ? " BENT" : "     ",
                valMiddle, abs(valMiddle - baseMiddle), middleBent ? " BENT" : "     ");

  String gestureCode = "";
  String gestureMsg  = "";

  // Gesture mapping based on natural finger bending:
  if (indexBent && middleBent) {
    gestureCode = "HELP";
    gestureMsg  = "எனக்கு உதவி தேவை (I NEED HELP)";
  } else if (middleBent && !indexBent) {
    gestureCode = "WATER";
    gestureMsg  = "தண்ணீர் வேண்டும் (I NEED WATER)";
  } else if (indexBent && !middleBent) {
    gestureCode = "MEDICINE";
    gestureMsg  = "மருந்து தேவை (I NEED MEDICINE)";
  }

  // Send alert if gesture detected and cooldown has passed
  if (gestureCode.length() > 0 && (millis() - lastSendTime > SEND_COOLDOWN_MS)) {
    Serial.printf("\n>>> [ALERT TRIGGERED] Code: %s | Msg: %s\n", gestureCode.c_str(), gestureMsg.c_str());
    sendGestureToSupabase(gestureCode, gestureMsg, valThumb, valIndex, valMiddle, valRing, valPinky);
    lastSendTime = millis();
  }

  delay(300);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection failed. Retrying...");
  }
}

void sendGestureToSupabase(String code, String message, int f1, int f2, int f3, int f4, int f5) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi offline. Skipping alert.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Bypass cert verification on ESP32

  HTTPClient https;
  if (!https.begin(client, SUPABASE_RPC_URL)) {
    Serial.println("[HTTP] Unable to connect to Supabase RPC endpoint");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("apikey", SUPABASE_ANON_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  String payload = "{\n";
  payload += "  \"device_key\": \"" + String(DEVICE_KEY) + "\",\n";
  payload += "  \"gesture_code\": \"" + code + "\",\n";
  payload += "  \"gesture_message\": \"" + message + "\",\n";
  payload += "  \"sensor_data\": {\n";
  payload += "    \"flex1\": " + String(f1) + ",\n";
  payload += "    \"flex2\": " + String(f2) + ",\n";
  payload += "    \"flex3\": " + String(f3) + ",\n";
  payload += "    \"flex4\": " + String(f4) + ",\n";
  payload += "    \"flex5\": " + String(f5) + "\n";
  payload += "  }\n";
  payload += "}";

  Serial.println("[HTTP] Sending POST to Supabase Cloud...");
  int httpCode = https.POST(payload);

  Serial.printf("[HTTP] Response Code: %d\n", httpCode);

  if (httpCode > 0) {
    String response = https.getString();
    Serial.println("[HTTP] Response body:");
    Serial.println(response);

    if (httpCode == 200) {
      Serial.println("[SUCCESS] Alert delivered to caregivers in real-time!");
    } else {
      Serial.printf("[WARN] Server returned status %d. Verify DEVICE_KEY in profile.\n", httpCode);
    }
  } else {
    Serial.printf("[ERROR] HTTP POST failed, error: %s\n", https.errorToString(httpCode).c_str());
  }

  https.end();
}
