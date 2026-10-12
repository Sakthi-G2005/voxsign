import { useCallback, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Hand, HeartHandshake, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DEMO_GESTURES,
  STATUS_ORDER,
  formatTime,
  relativeTime,
  type HelpRequest,
  type Profile,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useMyRequests, useRequestsRealtime, useSendGesture } from "@/features/requests";
import { useSpeaker } from "@/features/speaker";

export function SenderDashboard({ profile }: { profile: Profile }) {
  const { data: requests = [], isLoading } = useMyRequests(profile.id);
  const send = useSendGesture(profile.id);
  const speaker = useSpeaker();
  useRequestsRealtime();

  const trigger = useCallback(
    (code: string, message: string) => {
      speaker.speak(message);
      send.mutate(
        { code, message },
        {
          onSuccess: () => toast.success(`${message} sent to receivers`),
          onError: (error) => toast.error(error.message),
        },
      );
    },
    [send, speaker],
  );

  // Speak gestures coming from the ESP32 glove (they never pass through
  // `trigger`, so without this nothing plays on the sender's speaker).
  const spokenIdRef = useRef<string | null>(null);
  const latestDeviceGesture = requests.find((r) => r.source === "device");
  useEffect(() => {
    if (!latestDeviceGesture) return;
    if (spokenIdRef.current === latestDeviceGesture.id) return;
    spokenIdRef.current = latestDeviceGesture.id;
    speaker.speak(latestDeviceGesture.message);
  }, [latestDeviceGesture, speaker]);

  const active = requests.find((r) => r.status !== "help_provided");
  const helped = requests.filter((r) => r.status === "help_provided").length;

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <span className="font-semibold">Voice output:</span>{" "}
          <span className={speaker.connected ? "text-success" : "text-muted-foreground"}>
            {speaker.connected
              ? `🟢 Speaking through ${speaker.device?.name ?? "Bluetooth speaker"}`
              : "⚪ No Bluetooth speaker connected"}
          </span>
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/profile">{speaker.connected ? "Manage speaker" : "Connect speaker"}</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total requests" value={requests.length} />
        <Stat label="Awaiting help" value={requests.length - helped} tone="waiting" />
        <Stat label="Help provided" value={helped} tone="success" />
      </div>

      <GestureTranslator latest={requests[0]} onSpeak={(m) => speaker.speak(m)} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="surface-card flex flex-col items-center gap-5 p-8 text-center">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Emergency gesture
          </p>
          <button
            onClick={() => trigger("HELP", "I NEED HELP")}
            disabled={send.isPending}
            className="animate-pulse-ring flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full gradient-emergency text-emergency-foreground shadow-emergency transition-transform active:scale-95 disabled:opacity-70 sm:h-52 sm:w-52"
          >
            {send.isPending ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <AlertTriangle className="h-10 w-10" />
            )}
            <span className="font-display text-xl font-bold">I NEED HELP</span>
            <span className="text-xs opacity-80">Tap to alert receivers</span>
          </button>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your request reaches every receiver instantly and updates live as they respond.
          </p>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-base font-semibold">Latest request status</h2>
          {active ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{active.message}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(active.created_at)}</p>
                </div>
                <StatusBadge status={active.status} />
              </div>
              <Timeline request={active} />
            </div>
          ) : requests.length ? (
            <div className="mt-4 rounded-xl bg-success-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <HeartHandshake className="h-4 w-4" /> All your requests have been helped.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last update {relativeTime(requests[0]!.updated_at)}.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No requests yet. Press the button to send your first one.
            </p>
          )}
        </section>
      </div>

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">Demo gestures</h2>
        <p className="text-sm text-muted-foreground">
          Simulate the gestures the ESP32 glove will recognise.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DEMO_GESTURES.map((gesture) => (
            <button
              key={gesture.code}
              disabled={send.isPending}
              onClick={() => trigger(gesture.code, gesture.message)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors disabled:opacity-60",
                gesture.tone === "emergency" && "border-emergency/25 bg-emergency-soft",
                gesture.tone === "waiting" && "border-waiting/30 bg-waiting-soft",
                gesture.tone === "success" && "border-success/25 bg-success-soft",
              )}
            >
              <Hand className="h-4 w-4" />
              <p className="mt-2 font-display text-sm font-bold">{gesture.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{gesture.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent history</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">View all</Link>
          </Button>
        </div>
        {isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <RequestList requests={requests.slice(0, 5)} />
        )}
      </section>
    </div>
  );
}

function GestureTranslator({
  latest,
  onSpeak,
}: {
  latest: HelpRequest | undefined;
  onSpeak: (message: string) => void;
}) {
  const emergency = latest?.gesture_code === "HELP";
  return (
    <section className="surface-card flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Sign language translator · live
      </p>
      <div
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-3xl border",
          emergency
            ? "animate-pulse-ring border-emergency/30 bg-emergency-soft text-emergency"
            : "border-primary/25 bg-primary/5 text-primary",
        )}
      >
        <Hand className="h-14 w-14" />
      </div>
      {latest ? (
        <>
          <p className="font-display text-3xl font-bold tracking-tight">“{latest.message}”</p>
          <p className="text-xs text-muted-foreground">
            {relativeTime(latest.created_at)} ·{" "}
            {latest.source === "device" ? "ESP32 glove" : "App"}
          </p>
          <Button variant="outline" size="sm" onClick={() => onSpeak(latest.message)}>
            <Volume2 className="mr-2 h-4 w-4" /> Speak again
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Waiting for a gesture from your glove… recognized signs will appear here and speak aloud.
        </p>
      )}
    </section>
  );
}

export function RequestList({ requests }: { requests: HelpRequest[] }) {
  if (!requests.length) {
    return <p className="mt-4 text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-border">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-semibold">{r.message}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(r.created_at)} · {r.source === "device" ? "ESP32 glove" : "App"}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}

function Timeline({ request }: { request: HelpRequest }) {
  const currentIndex = STATUS_ORDER.indexOf(request.status);
  const times: Record<string, string | null> = {
    sent: request.created_at,
    delivered: request.delivered_at,
    seen: request.seen_at,
    help_provided: request.helped_at,
  };
  return (
    <ol className="mt-5 space-y-3">
      {STATUS_ORDER.map((status, index) => {
        const done = index <= currentIndex;
        return (
          <li key={status} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 h-3 w-3 shrink-0 rounded-full border-2",
                done ? "border-transparent bg-primary" : "border-border bg-background",
              )}
            />
            <div>
              <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>
                {status === "help_provided"
                  ? "Help Provided"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </p>
              {times[status] ? (
                <p className="text-xs text-muted-foreground">{formatTime(times[status]!)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "waiting" | "success" | "emergency";
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-3xl font-semibold",
          tone === "waiting" && "text-waiting-foreground",
          tone === "success" && "text-success",
          tone === "emergency" && "text-emergency",
        )}
      >
        {value}
      </p>
    </div>
  );
}
