// Client-side and hybrid notification engine for SMS and Email alerting.
import type { Language } from "@/lib/i18n";
import type { TrustedContact } from "@/lib/domain";

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsWebhookUrl: string;
  emailWebhookUrl: string;
  browserDispatchFallback: boolean;
}

const STORAGE_KEY = "voxsign_notification_settings_v1";

const DEFAULT_SETTINGS: NotificationSettings = {
  smsEnabled: true,
  emailEnabled: true,
  smsWebhookUrl: "",
  emailWebhookUrl: "",
  browserDispatchFallback: true,
};

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNotificationSettings(patch: Partial<NotificationSettings>): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const current = getNotificationSettings();
    const updated = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Formats an SMS URI compatible with both iOS and Android. */
export function buildSmsUri(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  // iOS uses '&body=', Android uses '?body='; '?&body=' works across both.
  return `sms:${cleanPhone}?&body=${encodeURIComponent(message)}`;
}

/** Formats a standard mailto URI. */
export function buildEmailUri(email: string, subject: string, body: string): string {
  const cleanEmail = email.trim();
  return `mailto:${cleanEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface EmergencyDispatchItem {
  contactName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  smsUri: string | null;
  emailUri: string | null;
  smsSent: boolean;
  emailSent: boolean;
}

export interface EmergencyEventDetail {
  requestId: string;
  senderName: string;
  gestureCode: string;
  gestureMessage: string;
  timestamp: string;
  items: EmergencyDispatchItem[];
}

export function buildEmergencySmsMessage(senderName: string, message: string, language: Language): string {
  if (language === "ta") {
    return `🚨 VOXSIGN அவசர உதவி!\n${senderName} உதவி கேட்கிறார்:\n"${message}"\nநேரம்: ${new Date().toLocaleTimeString()}\nஉடனடியாக செயலியை திறக்கவும்: https://sakthi-g2005.github.io/voxsign/`;
  }
  return `🚨 VOXSIGN EMERGENCY HELP REQUEST!\n${senderName} needs help:\n"${message}"\nTime: ${new Date().toLocaleTimeString()}\nOpen VoxSign to respond: https://sakthi-g2005.github.io/voxsign/`;
}

export function buildEmergencyEmailContent(
  senderName: string,
  message: string,
  relationship: string,
  language: Language,
): { subject: string; body: string } {
  if (language === "ta") {
    return {
      subject: `🚨 அவசர உதவி எச்சரிக்கை: ${senderName} உடனடி உதவி தேவை - "${message}"`,
      body: `அவசர உதவி கோரிக்கை\n\nஅனுப்புநர்: ${senderName}\nஉறவு: ${relationship}\nசைகை செய்தி: "${message}"\nநேரம்: ${new Date().toLocaleString()}\n\nதயவுசெய்து உடனடியாக VoxSign செயலியை திறந்து உதவவும்:\nhttps://sakthi-g2005.github.io/voxsign/\n\nஇது தானியங்கி அவசர எச்சரிக்கை செய்தி.`,
    };
  }
  return {
    subject: `🚨 EMERGENCY ALERT: ${senderName} needs immediate assistance - "${message}"`,
    body: `VOXSIGN EMERGENCY HELP REQUEST\n\nSender: ${senderName}\nRelationship: ${relationship}\nEmergency Message: "${message}"\nTimestamp: ${new Date().toLocaleString()}\n\nPlease respond or check on them immediately via VoxSign:\nhttps://sakthi-g2005.github.io/voxsign/\n\nThis is an automated emergency dispatch notification.`,
  };
}

/** Dispatches client-side notifications and fires the emergency event for UI quick actions. */
export async function dispatchClientEmergencyAlert(params: {
  requestId: string;
  senderName: string;
  gestureCode: string;
  gestureMessage: string;
  contacts: TrustedContact[];
  language: Language;
}): Promise<EmergencyEventDetail> {
  const settings = getNotificationSettings();
  const timestamp = new Date().toISOString();
  const smsBody = buildEmergencySmsMessage(params.senderName, params.gestureMessage, params.language);

  const items: EmergencyDispatchItem[] = params.contacts
    .filter((c) => c.is_active)
    .map((c) => {
      const emailContent = buildEmergencyEmailContent(
        params.senderName,
        params.gestureMessage,
        c.relationship,
        params.language,
      );

      const hasPhone = Boolean(c.phone && c.phone.trim().length >= 8);
      const hasEmail = Boolean(c.email && c.email.includes("@"));

      return {
        contactName: c.contact_name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email,
        smsUri: hasPhone && settings.smsEnabled ? buildSmsUri(c.phone!, smsBody) : null,
        emailUri:
          hasEmail && settings.emailEnabled
            ? buildEmailUri(c.email!, emailContent.subject, emailContent.body)
            : null,
        smsSent: hasPhone && settings.smsEnabled,
        emailSent: hasEmail && settings.emailEnabled,
      };
    });

  // If custom SMS Webhook is configured, send outbound POST
  if (settings.smsEnabled && settings.smsWebhookUrl) {
    try {
      void fetch(settings.smsWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          event: "emergency",
          sender: params.senderName,
          message: params.gestureMessage,
          recipients: items.map((i) => i.phone).filter(Boolean),
          timestamp,
        }),
      }).catch((e) => console.warn("[notifications] SMS webhook error", e));
    } catch (e) {
      console.warn("[notifications] SMS webhook trigger failed", e);
    }
  }

  // If custom Email Webhook is configured, send outbound POST
  if (settings.emailEnabled && settings.emailWebhookUrl) {
    try {
      void fetch(settings.emailWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          event: "emergency",
          sender: params.senderName,
          message: params.gestureMessage,
          recipients: items.map((i) => i.email).filter(Boolean),
          timestamp,
        }),
      }).catch((e) => console.warn("[notifications] Email webhook error", e));
    } catch (e) {
      console.warn("[notifications] Email webhook trigger failed", e);
    }
  }

  const detail: EmergencyEventDetail = {
    requestId: params.requestId,
    senderName: params.senderName,
    gestureCode: params.gestureCode,
    gestureMessage: params.gestureMessage,
    timestamp,
    items,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("voxsign:emergency_dispatch", { detail }));
  }

  return detail;
}
