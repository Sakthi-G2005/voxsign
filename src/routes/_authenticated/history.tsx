import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { StatusBadge } from "@/components/StatusBadge";
import { useAllRequests, useMyRequests, useRequestsRealtime } from "@/features/requests";
import { formatTime, type Profile } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — Gesture-to-Help" },
      { name: "description", content: "Complete log of assistance requests and their outcomes." },
      { property: "og:title", content: "History — Gesture-to-Help" },
      { property: "og:description", content: "Full request history with live status." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell profile={profile} title="History" subtitle="Full record of assistance requests">
          <HistoryBody profile={profile} />
        </AppShell>
      )}
    </RequireProfile>
  );
}

function HistoryBody({ profile }: { profile: Profile }) {
  const isReceiver = profile.role === "receiver";
  const mine = useMyRequests(isReceiver ? undefined : profile.id);
  const all = useAllRequests(isReceiver);
  useRequestsRealtime();

  const rows = isReceiver ? (all.data?.requests ?? []) : (mine.data ?? []);
  const senders = all.data?.senders ?? {};

  return (
    <section className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-secondary text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Message</th>
              {isReceiver ? <th className="px-4 py-3">Sender</th> : null}
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.message}</td>
                {isReceiver ? (
                  <td className="px-4 py-3">{senders[r.sender_id]?.full_name || "—"}</td>
                ) : null}
                <td className="px-4 py-3 text-muted-foreground">
                  {r.source === "device" ? "ESP32 glove" : "App"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatTime(r.created_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No requests recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
