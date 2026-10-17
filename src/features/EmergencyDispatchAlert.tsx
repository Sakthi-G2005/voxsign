import { useEffect, useState } from "react";
import { CheckCircle2, Send, ShieldCheck, X } from "lucide-react";
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

        // Automatically auto-dismiss after 6 seconds so it never interrupts or requires user permission
        const timer = setTimeout(() => {
          setDetail(null);
        }, 6000);
        return () => clearTimeout(timer);
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
      aria-live="polite"
      aria-label="Automated notification delivery confirmation"
      className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] rounded-2xl border border-success/30 bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isTamil
                ? "✅ அவசர செய்தி தானாகவே அனுப்பப்பட்டது"
                : "✅ Alert Sent Automatically (SMS & Email)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isTamil
                ? "பாதுகாவலர்களுக்கு பின்னணியில் நேரடியாக அனுப்பப்பட்டது"
                : "Dispatched directly to caregivers in the background"}
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

      <div className="mt-3 rounded-xl border border-border/60 bg-secondary/50 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {isTamil ? "அனுப்பப்பட்ட செய்தி:" : "Sent Message:"}{" "}
        </span>
        <strong className="text-foreground">"{detail.gestureMessage}"</strong>
      </div>

      {hasContacts && (
        <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
          {detail.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg bg-background/80 px-2.5 py-1.5 text-xs border border-border/40"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span className="font-semibold text-foreground">{item.contactName}</span>
                <span className="text-[11px] text-muted-foreground">({item.relationship})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                {item.smsSent && (
                  <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">SMS ✓</span>
                )}
                {item.emailSent && (
                  <span className="rounded bg-info/10 px-1.5 py-0.5 text-info">Email ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Send className="h-3 w-3 text-success" />
          {isTamil ? "தானியங்கி அறிவிப்பு இயங்கியது" : "100% Automated Dispatch"}
        </span>
        <button
          onClick={() => setDetail(null)}
          className="text-xs font-semibold text-primary hover:underline cursor-pointer"
        >
          {isTamil ? "சரி" : "OK"}
        </button>
      </div>
    </aside>
  );
}
