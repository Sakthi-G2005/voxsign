import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { SenderDashboard } from "@/features/SenderDashboard";
import { ReceiverDashboard } from "@/features/ReceiverDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gesture-to-Help" },
      { name: "description", content: "Send help gestures or respond to live assistance requests." },
      { property: "og:title", content: "Dashboard — Gesture-to-Help" },
      { property: "og:description", content: "Your live Gesture-to-Help control centre." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell
          profile={profile}
          title={profile.role === "receiver" ? "Receiver dashboard" : "Sender dashboard"}
          subtitle={
            profile.role === "receiver"
              ? "Respond to incoming assistance requests in real time"
              : "Raise a request and track it live"
          }
        >
          {profile.role === "receiver" ? (
            <ReceiverDashboard profile={profile} />
          ) : (
            <SenderDashboard profile={profile} />
          )}
        </AppShell>
      )}
    </RequireProfile>
  );
}
