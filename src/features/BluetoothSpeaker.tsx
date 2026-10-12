import { useState } from "react";
import { Bluetooth, BluetoothOff, Loader2, Search, Speaker, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSpeaker, type SpeakerDevice } from "@/features/speaker";

export function BluetoothSpeaker() {
  const speaker = useSpeaker();
  const [manualName, setManualName] = useState("");

  async function handleScan() {
    try {
      const found = await speaker.scan();
      if (!found.length) toast.info("No Bluetooth devices found nearby");
    } catch {
      toast.error(
        speaker.supported
          ? "Scan cancelled or no device selected"
          : "This browser cannot scan Bluetooth. Pair the speaker in your device settings, then add it below.",
      );
    }
  }

  function handleConnect(device: SpeakerDevice) {
    speaker.connect(device);
    toast.success(`Connected to ${device.name}`);
  }

  return (
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Speaker className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Bluetooth speaker</h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Bluetooth</span>
          <Switch checked={speaker.enabled} onCheckedChange={speaker.setEnabled} />
          <span className="font-semibold">{speaker.enabled ? "ON" : "OFF"}</span>
        </label>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Recognised gestures and incoming alerts are spoken aloud through your paired speaker.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            speaker.connected ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
          )}
        >
          {speaker.connected ? (
            <Bluetooth className="h-5 w-5" />
          ) : (
            <BluetoothOff className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {speaker.device?.name ?? "No speaker selected"}
          </p>
          <p
            className={cn(
              "text-xs font-medium",
              speaker.connected ? "text-success" : "text-muted-foreground",
            )}
          >
            {speaker.connected ? "🟢 Connected" : "⚪ Disconnected"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleScan}
            disabled={!speaker.enabled || speaker.scanning}
          >
            {speaker.scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {speaker.device ? "Change speaker" : "Search"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!speaker.enabled}
            onClick={() => {
              const ok = speaker.speak("Speaker test. Vox Sign voice output is working.");
              if (!ok) toast.error("Voice output unavailable in this browser");
            }}
          >
            <Volume2 className="h-3.5 w-3.5" /> Test speaker
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!speaker.connected}
            onClick={() => {
              speaker.disconnect();
              toast.success("Speaker disconnected");
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {speaker.enabled ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Available devices
          </p>
          {speaker.devices.length ? (
            <ul className="space-y-2">
              {speaker.devices.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="truncate text-sm">{d.name}</span>
                  {speaker.connected && speaker.device?.id === d.id ? (
                    <span className="text-xs font-semibold text-success">Connected</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleConnect(d)}>
                      Connect
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No devices listed yet. Tap Search to pick a nearby speaker.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-secondary p-3">
            <div className="min-w-[180px] flex-1">
              <p className="text-xs text-muted-foreground">
                Already paired in your phone settings? Add it by name.
              </p>
              <Input
                className="mt-2 bg-background"
                placeholder="JBL Go 3"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!manualName.trim()}
              onClick={() => {
                handleConnect({ id: `manual-${manualName.trim()}`, name: manualName.trim() });
                setManualName("");
              }}
            >
              Connect
            </Button>
          </div>
        </div>
      ) : null}

      {speaker.lastSpoken ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Last voice output: “{speaker.lastSpoken}”
        </p>
      ) : null}
    </section>
  );
}
