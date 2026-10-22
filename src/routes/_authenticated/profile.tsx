import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Hand,
  Loader2,
  Plus,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { CaregiverLinks } from "@/features/CaregiverLinks";
import { TrustedContacts } from "@/features/TrustedContacts";
import { BluetoothSpeaker } from "@/features/BluetoothSpeaker";
import { SenderProfileOverview } from "@/features/SenderProfileOverview";
import { NotificationSettings } from "@/features/NotificationSettings";
import type { DeviceRow, Profile } from "@/lib/domain";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Gesture-to-Help" },
      { name: "description", content: "Manage your account details and paired ESP32 devices." },
      { property: "og:title", content: "Profile — Gesture-to-Help" },
      { property: "og:description", content: "Account settings and hardware device keys." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useLanguage();
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell profile={profile} title={t("profile_title")} subtitle={t("profile_subtitle")}>
          <ProfileBody profile={profile} />
        </AppShell>
      )}
    </RequireProfile>
  );
}

const SUPABASE_RPC_SQL = `-- 1-Click Supabase SQL Setup for ESP32 Hardware
-- Paste and run in: https://supabase.com/dashboard/project/thpjccuzjyjtryvgcjmp/sql/new

CREATE OR REPLACE FUNCTION public.submit_device_gesture(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _device_key text;
  _gesture_code text;
  _gesture_message text;
  _sensor_data jsonb;
  _device record;
  _request_id uuid;
  _code text;
  _message text;
BEGIN
  _device_key := COALESCE(payload->>'device_key', payload->>'p_device_key');
  _gesture_code := COALESCE(payload->>'gesture_code', payload->>'p_gesture_code', 'HELP');
  _gesture_message := COALESCE(payload->>'gesture_message', payload->>'p_gesture_message');
  _sensor_data := COALESCE(payload->'sensor_data', payload->'p_sensor_data', '{}'::jsonb);

  IF _device_key IS NULL OR TRIM(_device_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing device_key in payload');
  END IF;

  SELECT id, user_id, is_active INTO _device
  FROM public.devices
  WHERE api_key = TRIM(_device_key);

  IF _device.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid device key');
  END IF;

  IF NOT _device.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Device is disabled');
  END IF;

  _code := UPPER(REPLACE(TRIM(_gesture_code), ' ', '_'));
  _message := COALESCE(NULLIF(TRIM(_gesture_message), ''), REPLACE(_code, '_', ' '));

  INSERT INTO public.help_requests (sender_id, gesture_code, message, status, source)
  VALUES (_device.user_id, _code, _message, 'sent', 'device')
  RETURNING id INTO _request_id;

  INSERT INTO public.gesture_events (
    user_id,
    device_id,
    help_request_id,
    gesture_code,
    gesture_message,
    sensor_data,
    source
  )
  VALUES (
    _device.user_id,
    _device.id,
    _request_id,
    _code,
    _message,
    _sensor_data,
    'device'
  );

  UPDATE public.devices
  SET last_seen_at = now()
  WHERE id = _device.id;

  RETURN jsonb_build_object(
    'ok', true,
    'help_request_id', _request_id,
    'gesture_code', _code,
    'gesture_message', _message,
    'status', 'sent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_device_gesture(jsonb) TO anon, authenticated, service_role;`;

function getArduinoCode(rpcUrl: string, anonKey: string, deviceKey: string) {
  return `/*
 * =====================================================================
 *  VoxSign ESP32 Smart Glove Firmware (Zero-Calibration & Zero-SQL)
 *  
 *  - ZERO MANUAL CALIBRATION:
 *    Automatically measures and locks in your natural resting hand baseline
 *    on boot (~0.8s). No manual threshold calibration or numbers needed!
 *
 *  - ZERO SQL SETUP:
 *    Pre-configured with automated Supabase authentication.
 *    No need to open Supabase SQL editor or create RPC functions manually.
 *
 *  - ZERO 405 ERRORS:
 *    Sends 24/7 HTTPS REST requests directly to Supabase cloud,
 *    bypassing static GitHub Pages restrictions completely.
 *
 *  - REALTIME CAREGIVER ALERTS:
 *    Directly creates alerts in help_requests & gesture_events tables,
 *    triggering instant sound & visual alerts on caregiver dashboards.
 * =====================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// =====================================================================
// 1. WiFi Configuration (Update with your local Wi-Fi details)
// =====================================================================
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// =====================================================================
// 2. Supabase Cloud Configuration (Pre-configured, Zero-SQL needed)
// =====================================================================
const char* SUPABASE_AUTH_URL   = "https://thpjccuzjyjtryvgcjmp.supabase.co/auth/v1/token?grant_type=password";
const char* SUPABASE_HELP_URL   = "https://thpjccuzjyjtryvgcjmp.supabase.co/rest/v1/help_requests";
const char* SUPABASE_EVENTS_URL = "https://thpjccuzjyjtryvgcjmp.supabase.co/rest/v1/gesture_events";
const char* SUPABASE_ANON_KEY   = "sb_publishable_F9sfFPCQHDdSMa27udqxOw_8O0rv61E";

// Dedicated Hardware Sender Device Account (Automated Auth)
const char* DEVICE_EMAIL        = "esp32_device@voxsign.local";
const char* DEVICE_PASSWORD     = "DevicePassword123!";
const char* SENDER_USER_ID      = "8ed0145d-c89c-4173-9170-d4fcd314c021";
const char* DEVICE_ID           = "588a9b30-5759-49cb-9b05-acd34369f08d";

// =====================================================================
// 3. Flex Sensor Pins (ADC1 Pins - Safe with WiFi)
// =====================================================================
const int PIN_FLEX_THUMB  = 36; // Thumb  (GPIO 36 / VP)
const int PIN_FLEX_INDEX  = 34; // Flex 2 (GPIO 34)
const int PIN_FLEX_MIDDLE = 35; // Flex 3 (GPIO 35)
const int PIN_FLEX_RING   = 32; // Flex 4 (GPIO 32)
const int PIN_FLEX_PINKY  = 33; // Flex 5 (GPIO 33)

// =====================================================================
// 4. Auto-Baseline Zero-Calibration Variables
// =====================================================================
int baseThumb  = 0;
int baseIndex  = 0;
int baseMiddle = 0;
int baseRing   = 0;
int basePinky  = 0;

// Bend threshold delta relative to natural resting position
const int BEND_DELTA = 350;

// Debounce & Cooldown between alert triggers (3 seconds)
unsigned long lastSendTime = 0;
const unsigned long SEND_COOLDOWN_MS = 3000;

// Token caching
String authToken = "";
unsigned long tokenTimestamp = 0;
const unsigned long TOKEN_LIFETIME_MS = 1800000; // Refresh after 30 mins

// Function declarations
void connectWiFi();
bool authenticateSupabase();
void sendGestureToSupabase(String code, String message, int f1, int f2, int f3, int f4, int f5);

// =====================================================================
// 5. Setup Function
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\\n=======================================================");
  Serial.println("  VoxSign ESP32 Smart Glove (Zero-Calibration & Zero-SQL) ");
  Serial.println("=======================================================");

  analogReadResolution(12);

  // 1. Establish baseline resting positions automatically (~0.75s)
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

  Serial.printf("[Auto-Baseline] Resting Base: Flex2(34)=%d | Flex3(35)=%d | Thumb=%d\\n",
                baseIndex, baseMiddle, baseThumb);
  Serial.println("[Auto-Baseline] Ready! Zero calibration required.");

  // 2. Connect WiFi
  connectWiFi();

  // 3. Authenticate with Supabase Cloud
  if (WiFi.status() == WL_CONNECTED) {
    authenticateSupabase();
  }
}

// =====================================================================
// 6. Main Loop
// =====================================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Refresh auth token periodically
  if (authToken.length() == 0 || (millis() - tokenTimestamp > TOKEN_LIFETIME_MS)) {
    authenticateSupabase();
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

  Serial.printf("Flex2(34): %4d (Δ%3d%s) | Flex3(35): %4d (Δ%3d%s)\\n",
                valIndex, abs(valIndex - baseIndex), indexBent ? " BENT" : "     ",
                valMiddle, abs(valMiddle - baseMiddle), middleBent ? " BENT" : "     ");

  String gestureCode = "";
  String gestureMsg  = "";

  // Gesture mapping:
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

  // Send alert if gesture detected and cooldown has elapsed
  if (gestureCode.length() > 0 && (millis() - lastSendTime > SEND_COOLDOWN_MS)) {
    Serial.printf("\\n>>> [ALERT TRIGGERED] Code: %s | Msg: %s\\n", gestureCode.c_str(), gestureMsg.c_str());
    sendGestureToSupabase(gestureCode, gestureMsg, valThumb, valIndex, valMiddle, valRing, valPinky);
    lastSendTime = millis();
  }

  delay(300);
}

// =====================================================================
// 7. WiFi Connection Helper
// =====================================================================
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
    Serial.println("\\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\\n[WiFi] Connection failed. Retrying in background...");
  }
}

// =====================================================================
// 8. Automated Supabase Authentication (No manual SQL needed)
// =====================================================================
bool authenticateSupabase() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.println("[Auth] Authenticating device with Supabase Cloud...");
  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL cert validation on ESP32

  HTTPClient https;
  if (!https.begin(client, SUPABASE_AUTH_URL)) {
    Serial.println("[Auth] Failed to initialize HTTPS client");
    return false;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("apikey", SUPABASE_ANON_KEY);

  String payload = "{\\"email\\":\\"" + String(DEVICE_EMAIL) + "\\",\\"password\\":\\"" + String(DEVICE_PASSWORD) + "\\"}";
  int code = https.POST(payload);

  if (code == 200) {
    String resp = https.getString();
    int tokenKeyIdx = resp.indexOf("\\"access_token\\":\\"");
    if (tokenKeyIdx != -1) {
      int startIdx = tokenKeyIdx + 16;
      int endIdx = resp.indexOf("\\"", startIdx);
      if (endIdx != -1) {
        authToken = resp.substring(startIdx, endIdx);
        tokenTimestamp = millis();
        Serial.println("[Auth] Authentication successful! Hardware token secured.");
        https.end();
        return true;
      }
    }
  }

  Serial.printf("[Auth] Failed to authenticate. HTTP Code: %d\\n", code);
  https.end();
  return false;
}

// =====================================================================
// 9. Send Gesture Alert directly to Supabase REST API (No 405 Error)
// =====================================================================
void sendGestureToSupabase(String code, String message, int f1, int f2, int f3, int f4, int f5) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected. Cannot send alert.");
    return;
  }

  // Ensure valid token
  if (authToken.length() == 0) {
    if (!authenticateSupabase()) {
      Serial.println("[HTTP] Could not authenticate. Aborting alert.");
      return;
    }
  }

  WiFiClientSecure client;
  client.setInsecure();

  // Step 1: Insert into public.help_requests (Triggers Caregiver Realtime Dashboards)
  HTTPClient https;
  if (https.begin(client, SUPABASE_HELP_URL)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_ANON_KEY);
    https.addHeader("Authorization", "Bearer " + authToken);
    https.addHeader("Prefer", "return=minimal");

    String helpPayload = "{\\"sender_id\\":\\"" + String(SENDER_USER_ID) +
                         "\\",\\"gesture_code\\":\\"" + code +
                         "\\",\\"message\\":\\"" + message +
                         "\\",\\"status\\":\\"sent\\",\\"source\\":\\"device\\"}";

    Serial.println("[HTTP] Dispatching alert to help_requests...");
    int httpCode = https.POST(helpPayload);

    if (httpCode == 200 || httpCode == 201) {
      Serial.printf("[SUCCESS] Caregiver Alert Created! HTTP %d (Broadcasted via Supabase Realtime!)\\n", httpCode);
    } else if (httpCode == 401 || httpCode == 403) {
      Serial.println("[Auth] Token expired. Re-authenticating...");
      authToken = "";
      authenticateSupabase();
    } else {
      Serial.printf("[WARN] help_requests responded with HTTP %d\\n", httpCode);
    }
    https.end();
  }

  // Step 2: Insert into public.gesture_events (Hardware sensor telemetry log)
  if (https.begin(client, SUPABASE_EVENTS_URL)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("apikey", SUPABASE_ANON_KEY);
    https.addHeader("Authorization", "Bearer " + authToken);
    https.addHeader("Prefer", "return=minimal");

    String eventPayload = "{\\"user_id\\":\\"" + String(SENDER_USER_ID) +
                          "\\",\\"device_id\\":\\"" + String(DEVICE_ID) +
                          "\\",\\"gesture_code\\":\\"" + code +
                          "\\",\\"gesture_message\\":\\"" + message +
                          "\\",\\"sensor_data\\":{\\"flex1\\":" + String(f1) +
                          ",\\"flex2\\":" + String(f2) +
                          ",\\"flex3\\":" + String(f3) +
                          ",\\"flex4\\":" + String(f4) +
                          ",\\"flex5\\":" + String(f5) + "}," +
                          "\\"source\\":\\"device\\"}";

    int eventCode = https.POST(eventPayload);
    if (eventCode == 200 || eventCode == 201) {
      Serial.printf("[SUCCESS] Sensor Telemetry Saved! HTTP %d\\n", eventCode);
    }
    https.end();
  }
}
`;
}
function ProfileBody({ profile }: { profile: Profile }) {
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.full_name);

  const saveName = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profile_updated"));
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const devices = useQuery({
    queryKey: ["devices", profile.id],
    queryFn: async (): Promise<DeviceRow[]> => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });

  const addDevice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("devices")
        .insert({ user_id: profile.id, name: "ESP32 Flex Glove" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("device_key_created"));
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const supabaseUrl =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://thpjccuzjyjtryvgcjmp.supabase.co";
  const supabaseAnonKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_F9sfFPCQHDdSMa27udqxOw_8O0rv61E";
  const hardwareEndpoint = `${supabaseUrl}/rest/v1/help_requests`;
  const activeDeviceKey = devices.data?.[0]?.api_key || "YOUR_DEVICE_KEY_FROM_ABOVE";

  return (
    <div className="space-y-6">
      {/* Language Switching Section */}
      <section className="surface-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("language_title")}</h2>
            <p className="text-xs text-muted-foreground">{t("language_subtitle")}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-md">
          <button
            type="button"
            onClick={() => {
              setLanguage("en");
              toast.success("Language changed to English");
            }}
            className={cn(
              "flex items-center justify-between rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer",
              language === "en"
                ? "border-primary bg-primary/5 text-foreground shadow-sm"
                : "border-border bg-card hover:border-primary/40 text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                EN
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("english_label")}</p>
                <p className="text-[11px] text-muted-foreground">Default system</p>
              </div>
            </div>
            {language === "en" && <Check className="h-4 w-4 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setLanguage("ta");
              toast.success("மொழி தமிழுக்கு மாற்றப்பட்டது");
            }}
            className={cn(
              "flex items-center justify-between rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer",
              language === "ta"
                ? "border-primary bg-primary/5 text-foreground shadow-sm"
                : "border-border bg-card hover:border-primary/40 text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                த
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("tamil_label")}</p>
                <p className="text-[11px] text-muted-foreground">தமிழ் இடைமுகம்</p>
              </div>
            </div>
            {language === "ta" && <Check className="h-4 w-4 text-primary" />}
          </button>
        </div>
      </section>

      {profile.role === "sender" ? (
        <>
          <SenderProfileOverview profile={profile} />
          <BluetoothSpeaker />
          <TrustedContacts profile={profile} />
        </>
      ) : (
        <>
          <BluetoothSpeaker />
          <CaregiverLinks profile={profile} />
        </>
      )}

      {/* SMS & Email Notification Channels and Settings */}
      <NotificationSettings profile={profile} />

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">{t("account_title")}</h2>
        <div className="mt-4 grid gap-4 sm:max-w-md">
          <div className="space-y-2">
            <Label htmlFor="name">{t("full_name")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("role")}</Label>
            <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm capitalize">
              {profile.role === "sender" ? t("sender_account") : t("receiver_account")}
            </p>
          </div>
          <Button onClick={() => saveName.mutate()} disabled={saveName.isPending} className="w-fit">
            {saveName.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save_changes")}
          </Button>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{t("esp32_devices")}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/gestures">
                <Hand className="h-4 w-4 mr-1.5 text-primary" />
                {language === "ta" ? "சைகைகள் (Gestures)" : "View Gestures"}
              </Link>
            </Button>
            <Button size="sm" onClick={() => addDevice.mutate()} disabled={addDevice.isPending}>
              <Plus className="h-4 w-4" /> {t("new_device_key")}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("device_desc")}
        </p>

        {devices.isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : devices.data?.length ? (
          <ul className="mt-4 space-y-3">
            {devices.data.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold">{d.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1 font-mono text-xs">
                    {d.api_key}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(d.api_key);
                      toast.success(t("device_key_copied"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("no_devices")}</p>
        )}


        {/* Live Supabase Endpoint Card */}
        <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                POST
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("hardware_endpoint")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(hardwareEndpoint);
                toast.success(t("hardware_copied"));
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {t("hardware_copy_code")}
            </Button>
          </div>
          <code className="block rounded-lg bg-secondary px-3 py-2 font-mono text-xs break-all text-primary">
            {hardwareEndpoint}
          </code>
        </div>

        {/* Interactive Tabs: Arduino Code, SQL Setup, cURL Test */}
        <div className="mt-4">
          <Tabs defaultValue="arduino" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="arduino" className="text-xs flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                <span className="truncate">{t("hardware_tab_arduino")}</span>
              </TabsTrigger>
              <TabsTrigger value="sql" className="text-xs flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span className="truncate">{t("hardware_tab_sql")}</span>
              </TabsTrigger>
              <TabsTrigger value="curl" className="text-xs flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                <span className="truncate">{t("hardware_tab_curl")}</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Arduino C++ Code */}
            <TabsContent value="arduino" className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {language === "ta"
                    ? "அளவீடு தேவையில்லாத (Zero-calibration) ESP32 குறியீடு (இயற்கையான விரல் நிலையைத் தொடக்கத்தில் தானாகவே அமைக்கும்):"
                    : "Zero-calibration C++ sketch for ESP32 (Auto-measures resting baseline at boot, no manual calibration needed):"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const code = getArduinoCode(hardwareEndpoint, supabaseAnonKey, activeDeviceKey);
                    void navigator.clipboard.writeText(code);
                    toast.success(t("hardware_copied"));
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {t("hardware_copy_code")}
                </Button>
              </div>
              <pre className="max-h-72 overflow-y-auto rounded-xl bg-secondary/80 p-3 font-mono text-[11px] leading-relaxed border border-border">
                {getArduinoCode(hardwareEndpoint, supabaseAnonKey, activeDeviceKey)}
              </pre>
            </TabsContent>

            {/* Tab 2: Supabase SQL Setup */}
            <TabsContent value="sql" className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t("hardware_sql_hint")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <a
                      href="https://supabase.com/dashboard/project/thpjccuzjyjtryvgcjmp/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      {t("hardware_sql_open")}
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(SUPABASE_RPC_SQL);
                      toast.success(t("hardware_copied"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    {t("hardware_copy_code")}
                  </Button>
                </div>
              </div>
              <pre className="max-h-72 overflow-y-auto rounded-xl bg-secondary/80 p-3 font-mono text-[11px] leading-relaxed border border-border">
                {SUPABASE_RPC_SQL}
              </pre>
            </TabsContent>

            {/* Tab 3: cURL Command */}
            <TabsContent value="curl" className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {language === "ta"
                    ? "முனையத்தில் (Terminal/CMD) நேரடியாக இயக்கி சோதனை செய்ய:"
                    : "Run directly in Terminal / Command Prompt to test endpoint delivery:"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const curlCmd = `curl.exe -i -X POST "${supabaseUrl}/auth/v1/token?grant_type=password" -H "apikey: ${supabaseAnonKey}" -H "Content-Type: application/json" -d "{\\"email\\":\\"esp32_device@voxsign.local\\",\\"password\\":\\"DevicePassword123!\\"}"`;
                    void navigator.clipboard.writeText(curlCmd);
                    toast.success(t("hardware_copied"));
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {t("hardware_copy_code")}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-secondary/80 p-3 font-mono text-[11px] leading-relaxed border border-border">
{`# 1. Test Device Login & Token:
curl.exe -i -X POST "${supabaseUrl}/auth/v1/token?grant_type=password" \\
  -H "apikey: ${supabaseAnonKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"esp32_device@voxsign.local","password":"DevicePassword123!"}'

# 2. Test Alert Delivery (Returns HTTP 201 Created):
curl.exe -i -X POST "${hardwareEndpoint}" \\
  -H "apikey: ${supabaseAnonKey}" \\
  -H "Authorization: Bearer <TOKEN_FROM_STEP_1>" \\
  -H "Content-Type: application/json" \\
  -d '{"sender_id":"8ed0145d-c89c-4173-9170-d4fcd314c021","gesture_code":"HELP","message":"I NEED HELP","status":"sent","source":"device"}'`}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
