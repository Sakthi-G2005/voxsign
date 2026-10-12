import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { StatusBadge } from "@/components/StatusBadge";
import { PrivateChat } from "@/features/PrivateChat";
import { useMyRequests, useRequestsRealtime } from "@/features/requests";
import { formatTime, relativeTime, type Profile } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Gesture-to-Help" },
      {
        name: "description",
        content: "Private chat with your linked caregivers plus request updates.",
      },
      { property: "og:title", content: "Messages — Gesture-to-Help" },
      { property: "og:description", content: "Private caregiver chat in real time." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell
          profile={profile}
          title="Messages"
          subtitle="Private chat with your linked caregivers"
        >
          <div className="space-y-6">
            <PrivateChat profile={profile} />
            {profile.role === "sender" ? <MessagesBody profile={profile} /> : null}
          </div>
        </AppShell>
      )}
    </RequireProfile>
  );
}

function MessagesBody({ profile }: { profile: Profile }) {
  const { data = [] } = useMyRequests(profile.id);
  useRequestsRealtime();

  if (!data.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Request updates</h2>
      {data.map((r) => (
        <article key={r.id} className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold">{r.message}</p>
              <p className="text-xs text-muted-foreground">{formatTime(r.created_at)}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Bubble side="out" text={`${r.gesture_code} — ${r.message}`} time={r.created_at} />
            {r.seen_at ? (
              <Bubble side="in" text="Your request has been seen." time={r.seen_at} />
            ) : null}
            {r.helped_at ? (
              <Bubble
                side="in"
                tone="success"
                text={r.responder_note || "A receiver is coming to help you."}
                time={r.helped_at}
              />
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function Bubble({
  side,
  text,
  time,
  tone,
}: {
  side: "in" | "out";
  text: string;
  time: string;
  tone?: "success";
}) {
  const base =
    side === "out"
      ? "ml-auto bg-primary text-primary-foreground"
      : tone === "success"
        ? "bg-success-soft text-success"
        : "bg-secondary text-secondary-foreground";
  return (
    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${base}`}>
      <p>{text}</p>
      <p className="mt-1 text-[11px] opacity-70">{relativeTime(time)}</p>
    </div>
  );
}
