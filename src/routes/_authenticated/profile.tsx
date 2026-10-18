import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Sliders,
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
 * VoxSign ESP32 Flex Glove Firmware
 * Connects directly to Supabase Cloud PostgREST RPC (Fixes HTTP 405)
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase PostgREST Cloud Endpoint (24/7 HTTPS)
const char* SUPABASE_RPC_URL  = "${rpcUrl}";
const char* SUPABASE_ANON_KEY = "${anonKey}";
const char* DEVICE_KEY        = "${deviceKey}";

// Flex Sensor Pins (ADC1)
const int PIN_FLEX_THUMB  = 36;
const int PIN_FLEX_INDEX  = 34; // Flex 2 (GPIO 34)
const int PIN_FLEX_MIDDLE = 35; // Flex 3 (GPIO 35)
const int PIN_FLEX_RING   = 32;
const int PIN_FLEX_PINKY  = 33;

const int THRESHOLD_BENT = 1800;
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi connected! Ready to send gestures.");
}

void loop() {
  int f1 = analogRead(PIN_FLEX_THUMB);
  int f2 = analogRead(PIN_FLEX_INDEX);  // GPIO 34
  int f3 = analogRead(PIN_FLEX_MIDDLE); // GPIO 35
  int f4 = analogRead(PIN_FLEX_RING);
  int f5 = analogRead(PIN_FLEX_PINKY);

  Serial.printf("Flex 2 (GPIO 34): %d | Flex 3 (GPIO 35): %d\\n", f2, f3);

  String code = "";
  String msg = "";
  if (f2 > THRESHOLD_BENT && f3 > THRESHOLD_BENT) {
    code = "HELP"; msg = "I NEED HELP";
  } else if (f3 > THRESHOLD_BENT) {
    code = "WATER"; msg = "I NEED WATER";
  } else if (f2 > THRESHOLD_BENT) {
    code = "MEDICINE"; msg = "I NEED MEDICINE";
  }

  if (code.length() > 0 && millis() - lastSend > 3000) {
    sendGesture(code, msg, f1, f2, f3, f4, f5);
    lastSend = millis();
  }
  delay(300);
}

void sendGesture(String code, String msg, int f1, int f2, int f3, int f4, int f5) {
  WiFiClientSecure client;
  client.setInsecure(); // Bypass cert verification
  HTTPClient http;
  if (!http.begin(client, SUPABASE_RPC_URL)) return;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  String body = "{\\"device_key\\":\\"" + String(DEVICE_KEY) +
                "\\",\\"gesture_code\\":\\"" + code +
                "\\",\\"gesture_message\\":\\"" + msg +
                "\\",\\"sensor_data\\":{\\"flex1\\":" + String(f1) +
                ",\\"flex2\\":" + String(f2) +
                ",\\"flex3\\":" + String(f3) +
                ",\\"flex4\\":" + String(f4) +
                ",\\"flex5\\":" + String(f5) + "}}";

  int code_resp = http.POST(body);
  Serial.printf("HTTP Response: %d\\n", code_resp);
  if (code_resp > 0) Serial.println(http.getString());
  http.end();
}`;
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
  const hardwareEndpoint = `${supabaseUrl}/rest/v1/rpc/submit_device_gesture`;
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
                <Sliders className="h-4 w-4 mr-1.5 text-primary" />
                {language === "ta" ? "சைகை அளவீடு (Calibration)" : "Gesture Calibration"}
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

        {/* HTTP 405 Not Allowed Resolution Alert */}
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-300">
                {t("hardware_405_title")}
              </p>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {t("hardware_405_desc")}
              </p>
            </div>
          </div>
        </div>

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
                    ? "GPIO 34 & 35 பின்களுடன் உங்கள் ESP32-ல் நேரடியாக பதிவேற்றக்கூடிய முழுமையான குறியீடு:"
                    : "Ready-to-flash C++ sketch for ESP32 with your GPIO 34 & 35 flex sensor pins:"}
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
                    const curlCmd = `curl.exe -i -X POST "${hardwareEndpoint}" -H "apikey: ${supabaseAnonKey}" -H "Content-Type: application/json" -d "{\\"device_key\\":\\"${activeDeviceKey}\\",\\"gesture_code\\":\\"HELP\\",\\"gesture_message\\":\\"I NEED HELP\\",\\"sensor_data\\":{\\"flex2\\":473,\\"flex3\\":2758}}"`;
                    void navigator.clipboard.writeText(curlCmd);
                    toast.success(t("hardware_copied"));
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {t("hardware_copy_code")}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-secondary/80 p-3 font-mono text-[11px] leading-relaxed border border-border">
{`curl.exe -i -X POST "${hardwareEndpoint}" \\
  -H "apikey: ${supabaseAnonKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_key": "${activeDeviceKey}",
    "gesture_code": "HELP",
    "gesture_message": "I NEED HELP",
    "sensor_data": { "flex2": 473, "flex3": 2758 }
  }'`}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
