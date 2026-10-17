import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Mail, MessageSquare, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type EmergencyEventDetail } from "@/lib/notifications";
import { useLanguage } from "@/lib/i18n";

export function EmergencyDispatchAlert() {
  const { language } = useLanguage();
  const [detail, setDetail] = useState<EmergencyEventDetail | null>(null);

  useEffect(() => {
    function handleDispatch(e: Event) {
      const customEvent = e as CustomEvent<EmergencyEventDetail>;
      if (customEvent.detail) {
        setDetail(customEvent.detail);
      }
    }

    window.addEventListener("voxsign:emergency_dispatch", handleDispatch);
    return () => window.removeEventListener("voxsign:emergency_dispatch", handleDispatch);
  }, []);

  if (!detail) return null;

  const hasContacts = detail.items.length > 0;
  const isTamil = language === "ta";

  return (
    <aside
      aria-label="Emergency notification dispatch"
      className="fixed bottom-6 right-6 z-50 max-w-lg w-[calc(100vw-3rem)] rounded-2xl border-2 border-emergency/40 bg-card p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emergency/15 text-emergency">
            <AlertCircle className="h-5 w-5 animate-pulse" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isTamil
                ? "🚨 அவசர உதவி அறிவிப்பு அனுப்பப்பட்டது"
                : "🚨 Emergency Dispatched (SMS & Email)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isTamil
                ? "பாதுகாவலர்களுக்கு உடனடி எச்சரிக்கைகள் அனுப்பப்பட்டுள்ளன"
                : "Instant SMS & Email alerts dispatched to your caregivers"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDetail(null)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3.5 rounded-xl border border-emergency/25 bg-emergency/10 p-3">
        <p className="text-[11px] font-bold text-emergency uppercase tracking-wider">
          {isTamil ? "அனுப்பப்பட்ட அவசர செய்தி:" : "Emergency Message:"}
        </p>
        <p className="text-base font-extrabold text-foreground mt-0.5">
          "{detail.gestureMessage}"
        </p>
      </div>

      {hasContacts ? (
        <div className="mt-3.5 space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {detail.items.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background/80 p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground">{item.contactName}</span>
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    ({item.relationship})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.phone && (
                    <span className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> SMS
                    </span>
                  )}
                  {item.email && (
                    <span className="flex items-center gap-1 rounded-md bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
                      <CheckCircle2 className="h-3 w-3" /> Email
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                {item.smsUri && (
                  <Button asChild size="xs" variant="outline" className="h-7 text-[11px]">
                    <a href={item.smsUri}>
                      <MessageSquare className="h-3 w-3 mr-1 text-primary" />
                      {isTamil ? "SMS திற" : "Open SMS App"}
                    </a>
                  </Button>
                )}
                {item.emailUri && (
                  <Button asChild size="xs" variant="outline" className="h-7 text-[11px]">
                    <a href={item.emailUri}>
                      <Mail className="h-3 w-3 mr-1 text-info" />
                      {isTamil ? "மின்னஞ்சல் திற" : "Open Email App"}
                    </a>
                  </Button>
                )}
                {item.phone && (
                  <Button asChild size="xs" variant="ghost" className="h-7 text-[11px]">
                    <a href={`tel:${item.phone}`}>
                      <Phone className="h-3 w-3 mr-1" />
                      {isTamil ? "அழைக்க" : "Call"}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {isTamil
            ? "குறிப்பு: நீங்கள் இன்னும் எந்தவொரு பாதுகாவலரின் தொலைபேசி அல்லது மின்னஞ்சலையும் சேர்க்கவில்லை. அமைப்புகளில் சேர்க்கவும்."
            : "Note: No caregiver phone or email added yet. Add trusted contacts in your Profile."}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-border">
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(
              `🚨 EMERGENCY HELP: ${detail.senderName} needs help: "${detail.gestureMessage}"`,
            );
            toast.success(isTamil ? "செய்தி நகலெடுக்கப்பட்டது" : "Emergency alert text copied");
          }}
          className="text-xs"
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          {isTamil ? "நகலெடு" : "Copy Alert Text"}
        </Button>
        <Button size="xs" onClick={() => setDetail(null)} className="text-xs">
          {isTamil ? "சரி" : "Dismiss"}
        </Button>
      </div>
    </aside>
  );
}
