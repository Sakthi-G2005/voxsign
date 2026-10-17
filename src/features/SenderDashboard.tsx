import { useCallback, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Hand, HeartHandshake, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  STATUS_ORDER,
  formatTime,
  relativeTime,
  type HelpRequest,
  type Profile,
} from "@/lib/domain";
import {
  getLocalizedGestures,
  translateGestureMessage,
  useLanguage,
  type TranslationKey,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMyRequests, useRequestsRealtime, useSendGesture } from "@/features/requests";
import { useSpeaker } from "@/features/speaker";

export function SenderDashboard({ profile }: { profile: Profile }) {
  const { language, t } = useLanguage();
  const gestures = getLocalizedGestures(language);
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
          onSuccess: () =>
            toast.success(
              language === "ta"
                ? `🚨 ${message} - SMS மற்றும் மின்னஞ்சல் தானாக அனுப்பப்பட்டது`
                : `🚨 ${message} - SMS & Email sent automatically`,
            ),
          onError: (error) => toast.error(error.message),
        },
      );
    },
    [send, speaker, language],
  );

  // Speak gestures coming from the ESP32 glove (they never pass through
  // `trigger`, so without this nothing plays on the sender's speaker).
  const spokenIdRef = useRef<string | null>(null);
  const latestDeviceGesture = requests.find((r) => r.source === "device");
  useEffect(() => {
    if (!latestDeviceGesture) return;
    if (spokenIdRef.current === latestDeviceGesture.id) return;
    spokenIdRef.current = latestDeviceGesture.id;
    const toSpeak = translateGestureMessage(
      latestDeviceGesture.gesture_code,
      latestDeviceGesture.message,
      language,
    );
    speaker.speak(toSpeak);
  }, [latestDeviceGesture, speaker, language]);

  const active = requests.find((r) => r.status !== "help_provided");
  const helped = requests.filter((r) => r.status === "help_provided").length;
  const emergencyMsg = language === "ta" ? "எனக்கு உதவி தேவை" : "I NEED HELP";

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <span className="font-semibold">
            {language === "ta" ? "குரல் வெளியீடு:" : "Voice output:"}
          </span>{" "}
          <span className={speaker.connected ? "text-success" : "text-muted-foreground"}>
            {speaker.connected
              ? `🟢 ${language === "ta" ? "பேசும் சாதனம்: " : "Speaking through "}${speaker.device?.name ?? (language === "ta" ? "புளூடூத் ஸ்பீக்கர்" : "Bluetooth speaker")}`
              : language === "ta"
                ? "⚪ புளூடூத் ஸ்பீக்கர் இணைக்கப்படவில்லை"
                : "⚪ No Bluetooth speaker connected"}
          </span>
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/profile">
            {speaker.connected
              ? language === "ta"
                ? "ஸ்பீக்கரை நிர்வகி"
                : "Manage speaker"
              : language === "ta"
                ? "ஸ்பீக்கரை இணைக்க"
                : "Connect speaker"}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("total_requests")} value={requests.length} />
        <Stat label={t("awaiting_help")} value={requests.length - helped} tone="waiting" />
        <Stat label={t("help_provided_count")} value={helped} tone="success" />
      </div>

      <GestureTranslator latest={requests[0]} onSpeak={(m) => speaker.speak(m)} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="surface-card flex flex-col items-center gap-5 p-8 text-center">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("emergency_gesture")}
          </p>
          <button
            onClick={() => trigger("HELP", emergencyMsg)}
            disabled={send.isPending}
            className="animate-pulse-ring flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full gradient-emergency text-emergency-foreground shadow-emergency transition-transform active:scale-95 disabled:opacity-70 sm:h-52 sm:w-52"
          >
            {send.isPending ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <AlertTriangle className="h-10 w-10" />
            )}
            <span className="font-display text-xl font-bold">{emergencyMsg}</span>
            <span className="text-xs opacity-80">{t("tap_to_alert")}</span>
          </button>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("emergency_desc")}
          </p>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-base font-semibold">{t("latest_request_status")}</h2>
          {active ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {translateGestureMessage(active.gesture_code, active.message, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTime(active.created_at)}</p>
                </div>
                <StatusBadge status={active.status} />
              </div>
              <Timeline request={active} />
            </div>
          ) : requests.length ? (
            <div className="mt-4 rounded-xl bg-success-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <HeartHandshake className="h-4 w-4" />{" "}
                {language === "ta"
                  ? "உங்கள் அனைத்து கோரிக்கைகளுக்கும் உதவி வழங்கப்பட்டுள்ளது."
                  : "All your requests have been helped."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {language === "ta" ? "கடைசி புதுப்பிப்பு " : "Last update "}
                {relativeTime(requests[0]!.updated_at)}.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("no_requests_yet")}
            </p>
          )}
        </section>
      </div>

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">{t("demo_gestures")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("demo_gestures_desc")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {gestures.map((gesture) => (
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
          <h2 className="text-base font-semibold">{t("recent_history")}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">{t("view_all")}</Link>
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
  const { language, t } = useLanguage();
  const emergency = latest?.gesture_code === "HELP";
  const displayMsg = translateGestureMessage(latest?.gesture_code, latest?.message, language);

  return (
    <section className="surface-card flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("translator_live")}
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
          <p className="font-display text-3xl font-bold tracking-tight">“{displayMsg}”</p>
          <p className="text-xs text-muted-foreground">
            {relativeTime(latest.created_at)} ·{" "}
            {latest.source === "device" ? "ESP32 glove" : language === "ta" ? "செயலி" : "App"}
          </p>
          <Button variant="outline" size="sm" onClick={() => onSpeak(displayMsg)}>
            <Volume2 className="mr-2 h-4 w-4" /> {t("speak_again")}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("waiting_gesture")}
        </p>
      )}
    </section>
  );
}

export function RequestList({ requests }: { requests: HelpRequest[] }) {
  const { language, t } = useLanguage();
  if (!requests.length) {
    return <p className="mt-4 text-sm text-muted-foreground">{t("nothing_here")}</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-border">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-semibold">
              {translateGestureMessage(r.gesture_code, r.message, language)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(r.created_at)} ·{" "}
              {r.source === "device" ? "ESP32 glove" : language === "ta" ? "செயலி" : "App"}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}

const TIMELINE_I18N_KEY: Record<string, TranslationKey> = {
  sent: "status_sent",
  delivered: "status_delivered",
  seen: "status_seen",
  help_provided: "status_help_provided",
};

function Timeline({ request }: { request: HelpRequest }) {
  const { t } = useLanguage();
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
                {t(TIMELINE_I18N_KEY[status]) ||
                  (status === "help_provided"
                    ? "Help Provided"
                    : status.charAt(0).toUpperCase() + status.slice(1))}
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
