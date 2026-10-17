import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Cpu, Globe, Loader2, Plus, Sliders } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/gesture` : "/api/public/gesture";

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

        <div className="mt-6 rounded-xl bg-secondary p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("hardware_endpoint")}
          </p>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed">
{`POST ${endpoint}
x-device-key: <your device key>
Content-Type: application/json

{
  "gesture_code": "HELP",
  "gesture_message": "I NEED HELP",
  "sensor_data": {
    "flex1": 720, "flex2": 480, "flex3": 750,
    "flex4": 150, "flex5": 20
  }
}`}
          </pre>
        </div>
      </section>
    </div>
  );
}
