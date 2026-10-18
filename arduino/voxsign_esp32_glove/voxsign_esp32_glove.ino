/*
 * VoxSign ESP32 Smart Glove Firmware
 * Connects directly to Supabase Cloud PostgREST RPC.
 * Bypasses static host limitations (resolves HTTP 405 Not Allowed).
 *
 * Hardware:
 *   - ESP32 Development Board
 *   - Flex Sensors (ADC1 Pins: GPIO 34, 35, 36, 32, 33)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ==========================================
// 1. WiFi & Cloud Configuration
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase PostgREST Cloud Endpoint
const char* SUPABASE_RPC_URL = "https://thpjccuzjyjtryvgcjmp.supabase.co/rest/v1/rpc/submit_device_gesture";
const char* SUPABASE_ANON_KEY = "sb_publishable_F9sfFPCQHDdSMa27udqxOw_8O0rv61E";

// Get this key from your VoxSign Profile > ESP32 Devices
const char* DEVICE_KEY = "YOUR_DEVICE_KEY_FROM_PROFILE";

// ==========================================
// 2. Flex Sensor Pin Configuration (ADC1)
// ==========================================
// User readings: Flex 2 (GPIO 34) ~ 473, Flex 3 (GPIO 35) ~ 2758
const int PIN_FLEX_THUMB  = 36; // ADC1_CH0 (VP)
const int PIN_FLEX_INDEX  = 34; // ADC1_CH6 - Flex 2
const int PIN_FLEX_MIDDLE = 35; // ADC1_CH7 - Flex 3
const int PIN_FLEX_RING   = 32; // ADC1_CH4
const int PIN_FLEX_PINKY  = 33; // ADC1_CH5

// Gesture detection thresholds (Adjust according to your glove calibration)
// In VoxSign, higher or lower ADC values indicate bent state depending on divider resistor setup.
const int THRESHOLD_INDEX_BENT  = 1500; 
const int THRESHOLD_MIDDLE_BENT = 2000;

// Debounce & Transmission cooldown
unsigned long lastSendTime = 0;
const unsigned long SEND_COOLDOWN_MS = 3000; // 3 seconds between alerts

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n======================================");
  Serial.println("  VoxSign ESP32 Smart Glove Starting  ");
  Serial.println("======================================");

  // Set ADC resolution (12-bit: 0 - 4095)
  analogReadResolution(12);

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Read raw flex sensor values
  int valThumb  = analogRead(PIN_FLEX_THUMB);
  int valIndex  = analogRead(PIN_FLEX_INDEX);   // GPIO 34
  int valMiddle = analogRead(PIN_FLEX_MIDDLE);  // GPIO 35
  int valRing   = analogRead(PIN_FLEX_RING);
  int valPinky  = analogRead(PIN_FLEX_PINKY);

  // Print live sensor readings to Serial
  Serial.printf("Flex 2 (GPIO 34): %d | Flex 3 (GPIO 35): %d | Thumb: %d | Ring: %d | Pinky: %d\n",
                valIndex, valMiddle, valThumb, valRing, valPinky);

  // Detect gestures based on finger positions
  String gestureCode = "";
  String gestureMessage = "";

  // Example: Both Index & Middle bent -> HELP
  if (valIndex > THRESHOLD_INDEX_BENT && valMiddle > THRESHOLD_MIDDLE_BENT) {
    gestureCode = "HELP";
    gestureMessage = "I NEED HELP";
  }
  // Example: Middle bent only -> WATER
  else if (valMiddle > THRESHOLD_MIDDLE_BENT && valIndex <= THRESHOLD_INDEX_BENT) {
    gestureCode = "WATER";
    gestureMessage = "I NEED WATER";
  }
  // Example: Index bent only -> MEDICINE
  else if (valIndex > THRESHOLD_INDEX_BENT && valMiddle <= THRESHOLD_MIDDLE_BENT) {
    gestureCode = "MEDICINE";
    gestureMessage = "I NEED MEDICINE";
  }

  // If a valid gesture is recognized and cooldown has passed, send to Supabase
  if (gestureCode.length() > 0 && (millis() - lastSendTime > SEND_COOLDOWN_MS)) {
    Serial.printf("\n>>> Triggering Gesture Alert: [%s] %s\n", gestureCode.c_str(), gestureMessage.c_str());
    sendGestureToSupabase(gestureCode, gestureMessage, valThumb, valIndex, valMiddle, valRing, valPinky);
    lastSendTime = millis();
  }

  delay(300); // 300ms sampling delay
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("Connecting to WiFi '%s'...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Connection failed. Will retry...");
  }
}

void sendGestureToSupabase(String code, String message, int f1, int f2, int f3, int f4, int f5) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected. Aborting request.");
    return;
  }

  // Use WiFiClientSecure with setInsecure to bypass cert chain verification on ESP32
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  if (!https.begin(client, SUPABASE_RPC_URL)) {
    Serial.println("[HTTP] Unable to connect to Supabase RPC endpoint");
    return;
  }

  // Set HTTP Headers required by Supabase PostgREST
  https.addHeader("Content-Type", "application/json");
  https.addHeader("apikey", SUPABASE_ANON_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  // Construct JSON Payload
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
      Serial.println("[SUCCESS] Gesture delivered to caregivers in real-time!");
    } else {
      Serial.printf("[WARN] Server returned status %d. Verify DEVICE_KEY in Supabase dashboard.\n", httpCode);
    }
  } else {
    Serial.printf("[ERROR] HTTP POST failed, error: %s\n", https.errorToString(httpCode).c_str());
  }

  https.end();
}
