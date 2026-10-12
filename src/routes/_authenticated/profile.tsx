import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Cpu, Loader2, Plus } from "lucide-react";
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
import type { DeviceRow, Profile } from "@/lib/domain";

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
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell profile={profile} title="Profile" subtitle="Account and hardware settings">
          <ProfileBody profile={profile} />
        </AppShell>
      )}
    </RequireProfile>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
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
      toast.success("Profile updated");
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
      toast.success("Device key created");
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/gesture` : "/api/public/gesture";

  return (
    <div className="space-y-6">
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

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">Account</h2>
        <div className="mt-4 grid gap-4 sm:max-w-md">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm capitalize">
              {profile.role}
            </p>
          </div>
          <Button onClick={() => saveName.mutate()} disabled={saveName.isPending} className="w-fit">
            {saveName.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">ESP32 devices</h2>
          </div>
          <Button size="sm" onClick={() => addDevice.mutate()} disabled={addDevice.isPending}>
            <Plus className="h-4 w-4" /> New device key
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Each device gets a private key. The glove sends it in the{" "}
          <code className="font-mono text-xs">x-device-key</code> header — never put backend admin
          keys in firmware or frontend code.
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
                      toast.success("Device key copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No devices paired yet.</p>
        )}

        <div className="mt-6 rounded-xl bg-secondary p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Hardware endpoint
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
