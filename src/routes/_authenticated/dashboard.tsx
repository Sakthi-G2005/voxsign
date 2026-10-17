import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireProfile } from "@/components/RequireProfile";
import { SenderDashboard } from "@/features/SenderDashboard";
import { ReceiverDashboard } from "@/features/ReceiverDashboard";
import { useLanguage } from "@/lib/i18n";

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
  const { language } = useLanguage();
  return (
    <RequireProfile>
      {(profile) => (
        <AppShell
          profile={profile}
          title={
            profile.role === "receiver"
              ? language === "ta"
                ? "பெறுநர் கட்டுப்பாட்டுப் பலகை"
                : "Receiver dashboard"
              : language === "ta"
                ? "அனுப்புநர் கட்டுப்பாட்டுப் பலகை"
                : "Sender dashboard"
          }
          subtitle={
            profile.role === "receiver"
              ? language === "ta"
                ? "உதவி கோரிக்கைகளுக்கு உடனுக்குடன் பதிலளிக்கவும்"
                : "Respond to incoming assistance requests in real time"
              : language === "ta"
                ? "உதவி கோரிக்கையை அனுப்பி நேரலையாகக் கண்காணிக்கவும்"
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
