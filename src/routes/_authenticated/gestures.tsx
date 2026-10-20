import { createFileRoute } from "@tanstack/react-router";
import { Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { useGestureEvents, useSendGesture } from "@/features/requests";
import { formatTime, type Profile } from "@/lib/domain";
import { getLocalizedGestures, translateGestureMessage, useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gestures")({
  head: () => ({
    meta: [
      { title: "Gestures — Gesture-to-Help" },
      { name: "description", content: "Trigger gestures and view live hardware flex sensor readings." },
      { property: "og:title", content: "Gestures — Gesture-to-Help" },
      { property: "og:description", content: "Gestures and live hardware event logs." },
    ],
  }),
  component: GesturesPage,
});

function GesturesPage() {
  const { t } = useLanguage();
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell profile={profile} title={t("nav_gestures")} subtitle={t("demo_gestures_desc")}>
          <GesturesBody profile={profile} />
        </AppShell>
      )}
    </RequireProfile>
  );
}

function GesturesBody({ profile }: { profile: Profile }) {
  const { language, t } = useLanguage();
  const send = useSendGesture(profile.id);
  const { data: events = [], isLoading } = useGestureEvents(profile.id);
  const gestures = getLocalizedGestures(language);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {gestures.map((g) => (
          <button
            key={g.code}
            disabled={send.isPending}
            onClick={() =>
              send.mutate(
                { code: g.code, message: g.message },
                {
                  onSuccess: () =>
                    toast.success(
                      language === "ta"
                        ? `🚨 ${g.message} - SMS & மின்னஞ்சல் தானாக அனுப்பப்பட்டது`
                        : `🚨 ${g.message} - SMS & Email sent automatically`,
                    ),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
            className={cn(
              "surface-card p-5 text-left transition-transform active:scale-[0.98] disabled:opacity-60",
              g.tone === "emergency" && "border-emergency/25",
              g.tone === "waiting" && "border-waiting/35",
              g.tone === "success" && "border-success/30",
            )}
          >
            <Hand className="h-5 w-5 text-primary" />
            <p className="mt-3 font-display text-base font-bold">{g.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">{g.code}</p>
          </button>
        ))}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">{t("gesture_event_log")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("gesture_event_log_desc")}
        </p>
        {isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : events.length ? (
          <ul className="mt-4 divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {translateGestureMessage(e.gesture_code, e.gesture_message, language)}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{e.gesture_code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTime(e.created_at)}</p>
                </div>
                {e.sensor_data && Object.keys(e.sensor_data).length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(e.sensor_data).map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px]"
                      >
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {language === "ta" ? "சைகை நிகழ்வுகள் எதுவும் இதுவரை பதிவு செய்யப்படவில்லை." : "No gesture events recorded yet."}
          </p>
        )}
      </section>
    </div>
  );
}
