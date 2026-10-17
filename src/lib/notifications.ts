// Real multi-gateway SMS and Email delivery engine for VoxSign.
// Supports Fast2SMS (India), Twilio (Global), EmailJS, Resend, and Webhooks.
import type { Language } from "@/lib/i18n";
import type { TrustedContact } from "@/lib/domain";

export type SmsProvider = "fast2sms" | "twilio" | "webhook" | "device";
export type EmailProvider = "emailjs" | "resend" | "webhook" | "device";

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;

  // SMS Configuration
  smsProvider: SmsProvider;
  fast2smsApiKey: string;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  smsWebhookUrl: string;

  // Email Configuration
  emailProvider: EmailProvider;
  emailjsPublicKey: string;
  emailjsServiceId: string;
  emailjsTemplateId: string;
  resendApiKey: string;
  emailWebhookUrl: string;

  autoDispatch: boolean;
}

const STORAGE_KEY = "voxsign_notification_settings_v2";

const DEFAULT_SETTINGS: NotificationSettings = {
  smsEnabled: true,
  emailEnabled: true,

  smsProvider: "fast2sms",
  fast2smsApiKey: "",
  twilioSid: "",
  twilioToken: "",
  twilioFrom: "",
  smsWebhookUrl: "",

  emailProvider: "emailjs",
  emailjsPublicKey: "",
  emailjsServiceId: "",
  emailjsTemplateId: "",
  resendApiKey: "",
  emailWebhookUrl: "",

  autoDispatch: true,
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

export function saveNotificationSettings(
  patch: Partial<NotificationSettings>,
): NotificationSettings {
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
  return `sms:${cleanPhone}?&body=${encodeURIComponent(message)}`;
}

/** Formats a standard mailto URI. */
export function buildEmailUri(email: string, subject: string, body: string): string {
  const cleanEmail = email.trim();
  return `mailto:${cleanEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildEmergencySmsMessage(
  senderName: string,
  message: string,
  language: Language,
): string {
  if (language === "ta") {
    return `🚨 VOXSIGN அவசர உதவி: ${senderName} உதவி கேட்கிறார்: "${message}". நேரம்: ${new Date().toLocaleTimeString()}. செயலியை திறக்கவும்: https://sakthi-g2005.github.io/voxsign/`;
  }
  return `🚨 VOXSIGN EMERGENCY HELP REQUEST: ${senderName} needs help: "${message}". Time: ${new Date().toLocaleTimeString()}. Open VoxSign: https://sakthi-g2005.github.io/voxsign/`;
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

export interface DeliveryResult {
  success: boolean;
  provider: string;
  statusText: string;
  fallbackUri?: string;
}

/** Sends a real SMS using the configured provider. */
export async function sendSmsReal(to: string, message: string): Promise<DeliveryResult> {
  const settings = getNotificationSettings();
  const cleaned = to.replace(/[^\d+]/g, "");
  if (cleaned.length < 8) {
    return { success: false, provider: "none", statusText: "Invalid recipient phone number" };
  }

  // 1. Fast2SMS (India Quick SMS API)
  if (settings.smsProvider === "fast2sms") {
    if (!settings.fast2smsApiKey) {
      return {
        success: false,
        provider: "Fast2SMS",
        statusText: "Fast2SMS API Key missing. Enter your key in Settings or send via Phone SIM.",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }

    try {
      // Strip leading country code (+91 or 91) to get 10-digit number for Fast2SMS Quick Route
      let indianNumber = cleaned.replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
      if (indianNumber.length !== 10) {
        indianNumber = cleaned;
      }

      const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(
        settings.fast2smsApiKey.trim(),
      )}&route=q&message=${encodeURIComponent(message)}&flash=0&numbers=${encodeURIComponent(
        indianNumber,
      )}`;

      const res = await fetch(url, { method: "GET" });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.return === true) {
        return { success: true, provider: "Fast2SMS", statusText: "SMS Delivered to mobile phone via Fast2SMS" };
      }
      return {
        success: false,
        provider: "Fast2SMS",
        statusText: json?.message?.[0] || json?.message || `Fast2SMS response code [${res.status}]`,
        fallbackUri: buildSmsUri(cleaned, message),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "Fast2SMS",
        statusText: err instanceof Error ? err.message : "Fast2SMS network error",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }
  }

  // 2. Direct Twilio REST API
  if (settings.smsProvider === "twilio") {
    if (!settings.twilioSid || !settings.twilioToken || !settings.twilioFrom) {
      return {
        success: false,
        provider: "Twilio",
        statusText: "Twilio credentials missing. Enter Account SID, Token, and From Number in Settings.",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }

    try {
      const auth = btoa(`${settings.twilioSid.trim()}:${settings.twilioToken.trim()}`);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioSid.trim()}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: cleaned.startsWith("+") ? cleaned : `+${cleaned}`,
            From: settings.twilioFrom.trim(),
            Body: message,
          }),
        },
      );
      if (res.ok) {
        return { success: true, provider: "Twilio", statusText: "SMS Delivered to mobile phone via Twilio" };
      }
      const errText = await res.text();
      return {
        success: false,
        provider: "Twilio",
        statusText: `Twilio error [${res.status}]: ${errText.slice(0, 80)}`,
        fallbackUri: buildSmsUri(cleaned, message),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "Twilio",
        statusText: err instanceof Error ? err.message : "Twilio network error",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }
  }

  // 3. Custom SMS Webhook (Zapier / Make / n8n / Webhook.site)
  if (settings.smsProvider === "webhook") {
    if (!settings.smsWebhookUrl) {
      return {
        success: false,
        provider: "Webhook",
        statusText: "SMS Webhook URL is empty. Add your Zapier or Make webhook URL in Settings.",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }

    try {
      const res = await fetch(settings.smsWebhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sms",
          to: cleaned,
          body: message,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        return { success: true, provider: "Webhook", statusText: "SMS Dispatched to Webhook endpoint" };
      }
      return {
        success: false,
        provider: "Webhook",
        statusText: `Webhook returned status [${res.status}]`,
        fallbackUri: buildSmsUri(cleaned, message),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "Webhook",
        statusText: err instanceof Error ? err.message : "Webhook network error",
        fallbackUri: buildSmsUri(cleaned, message),
      };
    }
  }

  // 4. Default: Phone SIM / Native Carrier
  return {
    success: false,
    provider: "device",
    statusText: "Ready to send via phone carrier SIM",
    fallbackUri: buildSmsUri(cleaned, message),
  };
}

/** Sends a real Email using the configured provider. */
export async function sendEmailReal(
  to: string,
  subject: string,
  body: string,
  senderName: string,
): Promise<DeliveryResult> {
  const settings = getNotificationSettings();
  const cleanEmail = to.trim();
  if (!cleanEmail.includes("@")) {
    return { success: false, provider: "none", statusText: "Invalid recipient email address" };
  }

  // 1. EmailJS (Browser-native, 200 free emails/month, no backend required)
  if (settings.emailProvider === "emailjs") {
    if (!settings.emailjsPublicKey) {
      return {
        success: false,
        provider: "EmailJS",
        statusText: "EmailJS Public Key missing. Enter your key in Settings or send via Mail App.",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }

    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: settings.emailjsServiceId.trim() || "default_service",
          template_id: settings.emailjsTemplateId.trim() || "template_emergency",
          user_id: settings.emailjsPublicKey.trim(),
          template_params: {
            to_email: cleanEmail,
            recipient: cleanEmail,
            sender_name: senderName,
            subject,
            message: body,
          },
        }),
      });

      if (res.ok) {
        return { success: true, provider: "EmailJS", statusText: "Email Delivered to inbox via EmailJS" };
      }
      const errText = await res.text();
      return {
        success: false,
        provider: "EmailJS",
        statusText: `EmailJS error [${res.status}]: ${errText.slice(0, 80)}`,
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "EmailJS",
        statusText: err instanceof Error ? err.message : "EmailJS network error",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }
  }

  // 2. Resend API
  if (settings.emailProvider === "resend") {
    if (!settings.resendApiKey) {
      return {
        success: false,
        provider: "Resend",
        statusText: "Resend API Key missing. Enter your Resend API Key in Settings.",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.resendApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "VoxSign Emergency Alert <onboarding@resend.dev>",
          to: [cleanEmail],
          subject,
          text: body,
        }),
      });

      if (res.ok) {
        return { success: true, provider: "Resend", statusText: "Email Delivered to inbox via Resend" };
      }
      const errText = await res.text();
      return {
        success: false,
        provider: "Resend",
        statusText: `Resend error [${res.status}]: ${errText.slice(0, 80)}`,
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "Resend",
        statusText: err instanceof Error ? err.message : "Resend network error",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }
  }

  // 3. Custom Email Webhook (Zapier / Make / n8n)
  if (settings.emailProvider === "webhook") {
    if (!settings.emailWebhookUrl) {
      return {
        success: false,
        provider: "Webhook",
        statusText: "Email Webhook URL is empty. Add your Zapier or Make webhook in Settings.",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }

    try {
      const res = await fetch(settings.emailWebhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          to: cleanEmail,
          subject,
          body,
          senderName,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        return { success: true, provider: "Webhook", statusText: "Email Dispatched to Webhook endpoint" };
      }
      return {
        success: false,
        provider: "Webhook",
        statusText: `Webhook returned status [${res.status}]`,
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "Webhook",
        statusText: err instanceof Error ? err.message : "Webhook network error",
        fallbackUri: buildEmailUri(cleanEmail, subject, body),
      };
    }
  }

  // 4. Default: Native Mail App
  return {
    success: false,
    provider: "device",
    statusText: "Ready to send via device Mail app",
    fallbackUri: buildEmailUri(cleanEmail, subject, body),
  };
}

export interface EmergencyDispatchItem {
  contactName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  smsResult: DeliveryResult | null;
  emailResult: DeliveryResult | null;
}

export interface EmergencyEventDetail {
  requestId: string;
  senderName: string;
  gestureCode: string;
  gestureMessage: string;
  timestamp: string;
  items: EmergencyDispatchItem[];
}

/** Dispatches emergency SMS and Email alerts in real time across configured gateways. */
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

  const activeContacts = params.contacts.filter((c) => c.is_active);
  const items: EmergencyDispatchItem[] = [];

  for (const contact of activeContacts) {
    let smsResult: DeliveryResult | null = null;
    let emailResult: DeliveryResult | null = null;

    if (contact.phone && settings.smsEnabled) {
      smsResult = await sendSmsReal(contact.phone, smsBody);
    }

    if (contact.email && settings.emailEnabled) {
      const emailContent = buildEmergencyEmailContent(
        params.senderName,
        params.gestureMessage,
        contact.relationship,
        params.language,
      );
      emailResult = await sendEmailReal(
        contact.email,
        emailContent.subject,
        emailContent.body,
        params.senderName,
      );
    }

    items.push({
      contactName: contact.contact_name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      smsResult,
      emailResult,
    });
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

/** Dispatches client-side status alerts (SMS/Email) in the background when caregiver responds. */
export async function dispatchClientStatusAlert(params: {
  requestId: string;
  senderPhone: string | null;
  senderEmail: string | null;
  senderName: string;
  caregiverName: string;
  status: "delivered" | "seen" | "help_provided";
  message: string;
  language: Language;
}): Promise<void> {
  const settings = getNotificationSettings();
  const isTamil = params.language === "ta";

  const statusLabel =
    params.status === "help_provided"
      ? isTamil
        ? "உதவி வருகிறது — உங்கள் பாதுகாவலர் உங்களை நோக்கி வருகிறார்."
        : "Help is on the way — your caregiver is coming."
      : params.status === "seen"
        ? isTamil
          ? "உங்கள் அவசர கோரிக்கையை பாதுகாவலர் பார்த்துள்ளார்."
          : "Your caregiver has seen your emergency request."
        : isTamil
          ? "உங்கள் கோரிக்கை பாதுகாவலருக்கு டெலிவரி செய்யப்பட்டது."
          : "Your emergency request was delivered.";

  const smsText = `VoxSign: ${params.caregiverName} - ${statusLabel}`;

  if (settings.smsEnabled && params.senderPhone) {
    void sendSmsReal(params.senderPhone, smsText);
  }

  if (settings.emailEnabled && params.senderEmail) {
    const subject = `VoxSign Update: ${statusLabel}`;
    const body = `${statusLabel}\n\nSender: ${params.senderName}\nCaregiver: ${params.caregiverName}\nOriginal message: "${params.message}"\nTime: ${new Date().toLocaleString()}`;
    void sendEmailReal(params.senderEmail, subject, body, params.caregiverName);
  }
}
