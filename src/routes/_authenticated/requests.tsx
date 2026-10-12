import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { RequestQueue } from "@/features/ReceiverDashboard";
import { useAllRequests, useRequestsRealtime, useUpdateRequestStatus } from "@/features/requests";
import type { Profile } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Requests — Gesture-to-Help" },
      { name: "description", content: "All open assistance requests waiting for a responder." },
      { property: "og:title", content: "Requests — Gesture-to-Help" },
      { property: "og:description", content: "Review and respond to open help requests." },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell profile={profile} title="Requests" subtitle="Every open assistance request">
          <RequestsBody profile={profile} />
        </AppShell>
      )}
    </RequireProfile>
  );
}

function RequestsBody({ profile }: { profile: Profile }) {
  const { data } = useAllRequests(profile.role === "receiver");
  const update = useUpdateRequestStatus(profile.id);
  useRequestsRealtime();

  if (profile.role !== "receiver") {
    return (
      <p className="surface-card p-6 text-sm text-muted-foreground">
        This page is available to receiver accounts.
      </p>
    );
  }

  const open = (data?.requests ?? []).filter((r) => r.status !== "help_provided");

  return (
    <section className="surface-card p-6">
      <RequestQueue
        requests={open}
        senders={data?.senders ?? {}}
        onSeen={(id) => update.mutate({ id, status: "seen" })}
        onHelp={(id) =>
          update.mutate(
            { id, status: "help_provided" },
            { onSuccess: () => toast.success("Marked as help provided") },
          )
        }
        pending={update.isPending}
      />
    </section>
  );
}
