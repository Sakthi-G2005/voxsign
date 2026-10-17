import { useCallback, useRef } from "react";
import { useSpeaker } from "@/features/speaker";
import { Eye, HeartHandshake, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/features/SenderDashboard";
import {
  useAllRequests,
  useRequestsRealtime,
  useUpdateRequestStatus,
} from "@/features/requests";
import { formatTime, relativeTime, type HelpRequest, type Profile } from "@/lib/domain";
import { translateGestureMessage, useLanguage } from "@/lib/i18n";

export function ReceiverDashboard({ profile }: { profile: Profile }) {
  const { language, t } = useLanguage();
  const { data, isLoading } = useAllRequests(true);
  const update = useUpdateRequestStatus(profile.id);
  const speaker = useSpeaker();
  const speakRef = useRef(speaker.speak);
  speakRef.current = speaker.speak;

  const onInsert = useCallback(
    (row: HelpRequest) => {
      const translated = translateGestureMessage(row.gesture_code, row.message, language);
      toast.warning(
        language === "ta" ? `புதிய கோரிக்கை: ${translated}` : `New request: ${row.message}`,
      );
      speakRef.current(
        language === "ta"
          ? `புதிய உதவி கோரிக்கை. ${translated}`
          : `New help request. ${row.message}`,
      );
      update.mutate({ id: row.id, status: "delivered" });
    },
    [update, language],
  );
  useRequestsRealtime(onInsert);

  const requests = data?.requests ?? [];
  const senders = data?.senders ?? {};
  const incoming = requests.filter((r) => r.status === "sent" || r.status === "delivered");
  const active = requests.filter((r) => r.status === "seen");
  const completed = requests.filter((r) => r.status === "help_provided");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={language === "ta" ? "புதிய கோரிக்கைகள்" : "New requests"}
          value={incoming.length}
          tone="emergency"
        />
        <Stat
          label={language === "ta" ? "செயலில் உள்ளவை" : "Active"}
          value={active.length}
          tone="waiting"
        />
        <Stat
          label={language === "ta" ? "உதவி வழங்கப்பட்டது" : "Completed"}
          value={completed.length}
          tone="success"
        />
      </div>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">
            {language === "ta" ? "நேரலை உதவி கோரிக்கைகள்" : "Live incoming requests"}
          </h2>
        </div>
        {isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <RequestQueue
            requests={[...incoming, ...active]}
            senders={senders}
            onSeen={(id) => update.mutate({ id, status: "seen" })}
            onHelp={(id) =>
              update.mutate(
                { id, status: "help_provided" },
                {
                  onSuccess: () =>
                    toast.success(
                      language === "ta" ? "உதவி வழங்கப்பட்டதாகக் குறிக்கப்பட்டது" : "Marked as help provided",
                    ),
                },
              )
            }
            pending={update.isPending}
          />
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">
          {language === "ta" ? "சமீபத்தில் முடிக்கப்பட்டவை" : "Recently completed"}
        </h2>
        {completed.length ? (
          <ul className="mt-4 divide-y divide-border">
            {completed.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {senders[r.sender_id]?.full_name || (language === "ta" ? "அனுப்புநர்" : "Sender")} ·{" "}
                    {translateGestureMessage(r.gesture_code, r.message, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ta" ? "உதவி செய்யப்பட்டது " : "Helped "}
                    {r.helped_at ? relativeTime(r.helped_at) : (language === "ta" ? "சமீபத்தில்" : "recently")}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {language === "ta" ? "முடிக்கப்பட்ட கோரிக்கைகள் எதுவும் இல்லை." : "No completed requests yet."}
          </p>
        )}
      </section>
    </div>
  );
}

export function RequestQueue({
  requests,
  senders,
  onSeen,
  onHelp,
  pending,
}: {
  requests: HelpRequest[];
  senders: Record<string, Profile>;
  onSeen: (id: string) => void;
  onHelp: (id: string) => void;
  pending: boolean;
}) {
  const { language, t } = useLanguage();
  if (!requests.length) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        {language === "ta"
          ? "தற்போது புதிய கோரிக்கைகள் எதுவும் இல்லை. புதிய கோரிக்கைகள் இங்கே உடனடியாக தோன்றும்."
          : "No open requests right now. New ones appear here instantly."}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {requests.map((r) => (
        <article
          key={r.id}
          className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">
                {translateGestureMessage(r.gesture_code, r.message, language)}
              </p>
              <p className="text-sm text-muted-foreground">
                {senders[r.sender_id]?.full_name || (language === "ta" ? "அறியப்படாத அனுப்புநர்" : "Unknown sender")} · {r.gesture_code}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTime(r.created_at)} · {relativeTime(r.created_at)} ·{" "}
                {r.source === "device" ? "ESP32 glove" : language === "ta" ? "செயலி" : "App"}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || r.status === "seen"}
              onClick={() => onSeen(r.id)}
            >
              <Eye className="h-4 w-4" /> {t("mark_as_seen")}
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onHelp(r.id)}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <HeartHandshake className="h-4 w-4" /> {t("i_will_help")}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
