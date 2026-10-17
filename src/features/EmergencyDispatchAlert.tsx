import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, ExternalLink, Mail, MessageSquare, Settings, ShieldCheck, X } from "lucide-react";
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

        // Auto-dismiss after 8 seconds if all succeeded
        const allDelivered = customEvent.detail.items.every(
          (i) => (!i.phone || i.smsResult?.success) && (!i.email || i.emailResult?.success),
        );
        if (allDelivered) {
          const timer = setTimeout(() => {
            setDetail(null);
          }, 6000);
          return () => clearTimeout(timer);
        }
      }
    }

    window.addEventListener("voxsign:emergency_dispatch", handleDispatch);
    return () => window.removeEventListener("voxsign:emergency_dispatch", handleDispatch);
  }, []);

  if (!detail) return null;

  const isTamil = language === "ta";
  const hasItems = detail.items.length > 0;

  const anyMissingCloudKey = detail.items.some(
    (i) => (i.phone && !i.smsResult?.success) || (i.email && !i.emailResult?.success),
  );

  return (
    <aside
      aria-live="polite"
      aria-label="Emergency alert dispatch"
      className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              anyMissingCloudKey
                ? "bg-warning/15 text-warning"
                : "bg-success/15 text-success"
            }`}
          >
            {anyMissingCloudKey ? (
              <AlertCircle className="h-5 w-5 animate-pulse" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {anyMissingCloudKey
                ? isTamil
                  ? "அவசர எச்சரிக்கை அனுப்புக"
                  : "Dispatch Emergency Alert"
                : isTamil
                  ? "✅ எச்சரிக்கை வெற்றிகரமாக அனுப்பப்பட்டது"
                  : "✅ Alert Delivered to Caregivers"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {anyMissingCloudKey
                ? isTamil
                  ? "கிளவுட் சாவி இல்லை — போன் சிம் வழியாக அனுப்பவும்"
                  : "Cloud API key not set — send via phone carrier"
                : isTamil
                  ? "பாதுகாவலர்களுக்கு நேரடியாக டெலிவரி செய்யப்பட்டது"
                  : "Delivered directly via cloud SMS & Email gateway"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDetail(null)}
          className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-border/70 bg-secondary/60 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {isTamil ? "சைகை செய்தி:" : "Emergency Sign:"}{" "}
        </span>
        <strong className="text-foreground">"{detail.gestureMessage}"</strong>
      </div>

      {hasItems && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-0.5">
          {detail.items.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-xl bg-background/90 p-2.5 text-xs border border-border/60"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground">{item.contactName}</span>
                  <span className="text-[11px] text-muted-foreground">({item.relationship})</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  {item.smsResult?.success && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">
                      SMS Delivered ✓
                    </span>
                  )}
                  {item.emailResult?.success && (
                    <span className="rounded bg-info/15 px-1.5 py-0.5 text-info">
                      Email Delivered ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Action Fallbacks if cloud key not yet configured */}
              {(!item.smsResult?.success || !item.emailResult?.success) && (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-border/40">
                  {item.phone && !item.smsResult?.success && item.smsResult?.fallbackUri && (
                    <Button asChild size="xs" variant="default" className="h-7 text-[11px] font-semibold">
                      <a href={item.smsResult.fallbackUri}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {isTamil ? "SMS அனுப்பு (போன் சிம்)" : "Send via Phone SMS"}
                      </a>
                    </Button>
                  )}
                  {item.email && !item.emailResult?.success && item.emailResult?.fallbackUri && (
                    <Button asChild size="xs" variant="outline" className="h-7 text-[11px]">
                      <a href={item.emailResult.fallbackUri}>
                        <Mail className="h-3 w-3 mr-1" />
                        {isTamil ? "மின்னஞ்சல் அனுப்பு" : "Send via Mail App"}
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {anyMissingCloudKey && (
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
          <Link
            to="/profile"
            onClick={() => setDetail(null)}
            className="flex items-center gap-1 text-primary hover:underline font-semibold"
          >
            <Settings className="h-3 w-3" />
            {isTamil ? "SMS & மின்னஞ்சல் API-ஐ அமைக்கவும்" : "Configure SMS/Email Gateway in Profile"}
          </Link>
          <button
            onClick={() => setDetail(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isTamil ? "மூடு" : "Dismiss"}
          </button>
        </div>
      )}
    </aside>
  );
}
