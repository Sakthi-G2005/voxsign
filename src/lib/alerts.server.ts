// Server-only outbound alerting (SMS via Twilio and Email via Resend / Webhook).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const RESEND_API_URL = "https://api.resend.com/emails";

export type AlertKind = "sent" | "delivered" | "seen" | "help_provided";

function smsConfig(): {
  mode: "gateway" | "direct" | "webhook";
  lovableKey?: string;
  twilioKey?: string;
  accountSid?: string;
  authToken?: string;
  from?: string;
  webhookUrl?: string;
} | null {
  const webhookUrl = process.env["SMS_WEBHOOK_URL"] || process.env["NOTIFICATION_WEBHOOK_URL"];
  if (webhookUrl) return { mode: "webhook", webhookUrl };

  const directSid = process.env["TWILIO_ACCOUNT_SID"];
  const directToken = process.env["TWILIO_AUTH_TOKEN"];
  const directFrom = process.env["TWILIO_FROM_NUMBER"];
  if (directSid && directToken && directFrom) {
    return { mode: "direct", accountSid: directSid, authToken: directToken, from: directFrom };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (lovableKey && twilioKey && from) {
    return { mode: "gateway", lovableKey, twilioKey, from };
  }

  return null;
}

function emailConfig(): {
  mode: "resend" | "webhook" | "lovable";
  resendKey?: string;
  lovableKey?: string;
  fromEmail?: string;
  webhookUrl?: string;
} | null {
  const webhookUrl = process.env["EMAIL_WEBHOOK_URL"] || process.env["NOTIFICATION_WEBHOOK_URL"];
  if (webhookUrl) return { mode: "webhook", webhookUrl };

  const resendKey = process.env["RESEND_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fromEmail = process.env["RESEND_FROM_EMAIL"] || "VoxSign Alerts <notifications@voxsign.dev>";

  if (lovableKey && resendKey) {
    return { mode: "lovable", lovableKey, resendKey, fromEmail };
  }
  if (resendKey) {
    return { mode: "resend", resendKey, fromEmail };
  }

  return null;
}

/** Sends one SMS. Returns false (without throwing) when messaging is not configured or refused. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const config = smsConfig();
  if (!config) {
    console.warn("[alerts] SMS skipped: Twilio sender or webhook not configured");
    return false;
  }
  const cleaned = to.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+") || cleaned.length < 8) {
    console.warn("[alerts] SMS skipped: recipient number is not in +country format");
    return false;
  }

  try {
    if (config.mode === "webhook" && config.webhookUrl) {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "sms", to: cleaned, body }),
      });
      return res.ok;
    }

    if (config.mode === "direct" && config.accountSid && config.authToken && config.from) {
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: cleaned, From: config.from, Body: body }),
        },
      );
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[alerts] Direct Twilio SMS failed [${res.status}]: ${errorText}`);
        return false;
      }
      return true;
    }

    if (config.mode === "gateway" && config.lovableKey && config.twilioKey && config.from) {
      const response = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.lovableKey}`,
          "X-Connection-Api-Key": config.twilioKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: cleaned, From: config.from, Body: body }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[alerts] Twilio gateway failed [${response.status}]: ${errorBody}`);
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error("[alerts] Twilio request threw", error);
    return false;
  }
}

/** Sends one Email. Returns false (without throwing) when email service is not configured or refused. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const config = emailConfig();
  if (!config) {
    console.warn("[alerts] Email skipped: Resend or email webhook not configured");
    return false;
  }

  const cleanEmail = to.trim().toLowerCase();
  if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
    console.warn("[alerts] Email skipped: invalid recipient email address");
    return false;
  }

  try {
    if (config.mode === "webhook" && config.webhookUrl) {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email", to: cleanEmail, subject, html, text }),
      });
      return res.ok;
    }

    if (config.mode === "resend" && config.resendKey) {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: [cleanEmail],
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[alerts] Resend email failed [${res.status}]: ${err}`);
        return false;
      }
      return true;
    }

    if (config.mode === "lovable" && config.lovableKey && config.resendKey) {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.lovableKey}`,
          "X-Connection-Api-Key": config.resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: [cleanEmail],
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[alerts] Lovable Resend email failed [${res.status}]: ${err}`);
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error("[alerts] Email request threw", error);
    return false;
  }
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

interface AlertTargets {
  senderName: string;
  gestureCode: string;
  message: string;
  createdAt: string;
  contacts: { name: string; relationship: string; phone: string | null; email: string | null }[];
  senderPhone: string | null;
  senderEmail: string | null;
}

async function loadTargets(requestId: string): Promise<AlertTargets | null> {
  const { data: request } = await supabaseAdmin
    .from("help_requests")
    .select("id, sender_id, gesture_code, message, created_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const { data: sender } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone, email, notify_all_contacts")
    .eq("id", request.sender_id)
    .maybeSingle();

  // Look for caregivers specifically notified through the notifications table
  const { data: notifications } = await supabaseAdmin
    .from("notifications")
    .select("receiver_id, trusted_contact_id")
    .eq("help_request_id", request.id);

  const contactIds = (notifications ?? [])
    .map((n) => n.trusted_contact_id)
    .filter((id): id is string => Boolean(id));

  let contacts: AlertTargets["contacts"] = [];
  if (contactIds.length) {
    const { data: rows } = await supabaseAdmin
      .from("trusted_contacts")
      .select("contact_name, relationship, phone, email")
      .in("id", contactIds);
    contacts = (rows ?? []).map((r) => ({
      name: r.contact_name,
      relationship: r.relationship,
      phone: r.phone,
      email: r.email,
    }));
  }

  // Fallback: If no notifications exist yet or notify_all_contacts is enabled,
  // load all active trusted contacts for this sender so SMS and Email notifications reach them.
  if (contacts.length === 0 || sender?.notify_all_contacts) {
    const { data: allRows } = await supabaseAdmin
      .from("trusted_contacts")
      .select("contact_name, relationship, phone, email, is_primary")
      .eq("sender_id", request.sender_id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("priority", { ascending: true });

    if (allRows?.length) {
      const activeContacts = allRows.map((r) => ({
        name: r.contact_name,
        relationship: r.relationship,
        phone: r.phone,
        email: r.email,
      }));
      contacts = sender?.notify_all_contacts ? activeContacts : [activeContacts[0]];
    }
  }

  return {
    senderName: sender?.full_name?.trim() || "Someone",
    gestureCode: request.gesture_code,
    message: request.message,
    createdAt: request.created_at,
    contacts,
    senderPhone: sender?.phone ?? null,
    senderEmail: sender?.email ?? null,
  };
}

/** Sends SMS and Email alerts to every caregiver notified about this emergency. */
export async function alertCaregiversOfRequest(
  requestId: string,
): Promise<{ sms: number; email: number }> {
  const targets = await loadTargets(requestId);
  if (!targets) return { sms: 0, email: 0 };

  let sms = 0;
  let email = 0;

  for (const contact of targets.contacts) {
    // 1. Send SMS if phone is available
    if (contact.phone) {
      const smsBody = `🚨 VOXSIGN EMERGENCY HELP REQUEST\n${targets.senderName} needs help: "${targets.message}"\nRelationship: ${contact.relationship}\nTime: ${timeLabel(targets.createdAt)} UTC\nPlease respond immediately in VoxSign.`;
      if (await sendSms(contact.phone, smsBody)) sms += 1;
    }

    // 2. Send Email if email address is available
    if (contact.email) {
      const subject = `🚨 EMERGENCY ALERT: ${targets.senderName} needs immediate help! - "${targets.message}"`;
      const text = `EMERGENCY HELP REQUEST\n\n${targets.senderName} has triggered an emergency help request:\n"${targets.message}"\n\nSender: ${targets.senderName}\nRelationship: ${contact.relationship}\nTime: ${timeLabel(targets.createdAt)} UTC\n\nPlease check on them or open VoxSign immediately to assist.`;
      const html = buildEmergencyEmailHtml({
        senderName: targets.senderName,
        gestureCode: targets.gestureCode,
        message: targets.message,
        relationship: contact.relationship,
        createdAt: targets.createdAt,
      });

      if (await sendEmail(contact.email, subject, html, text)) {
        email += 1;
      }
    }
  }

  return { sms, email };
}

/** Sends status updates via SMS and Email to the sender when a caregiver responds. */
export async function alertSenderOfStatus(
  requestId: string,
  status: AlertKind,
): Promise<{ sms: boolean; email: boolean }> {
  const targets = await loadTargets(requestId);
  if (!targets) return { sms: false, email: false };

  const text =
    status === "help_provided"
      ? "Help is on the way — your caregiver is coming."
      : status === "seen"
        ? "Your caregiver has seen your emergency request."
        : "Your emergency request was delivered to your caregiver.";

  let smsSent = false;
  let emailSent = false;

  if (targets.senderPhone) {
    smsSent = await sendSms(targets.senderPhone, `VoxSign update\n${text}`);
  }

  if (targets.senderEmail) {
    const subject = `VoxSign Status Update: ${text}`;
    const html = buildStatusEmailHtml({
      senderName: targets.senderName,
      statusText: text,
      status,
      message: targets.message,
      time: timeLabel(targets.createdAt),
    });
    emailSent = await sendEmail(targets.senderEmail, subject, html, text);
  }

  return { sms: smsSent, email: emailSent };
}

function buildEmergencyEmailHtml(data: {
  senderName: string;
  gestureCode: string;
  message: string;
  relationship: string;
  createdAt: string;
}): string {
  const time = timeLabel(data.createdAt);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Emergency Help Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fee2e2; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);">
    <!-- Urgent Alert Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 24px; text-align: center; color: #ffffff;">
      <span style="display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
        🚨 Urgent Emergency Alert
      </span>
      <h1 style="margin: 12px 0 4px; font-size: 24px; font-weight: 800; line-height: 1.2;">
        ${data.senderName} Needs Help
      </h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">
        Triggered via VoxSign Smart Gesture System
      </p>
    </div>

    <!-- Message Content -->
    <div style="padding: 28px;">
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #b91c1c; letter-spacing: 0.05em;">
          Emergency Gesture Message:
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: #991b1b;">
          "${data.message}"
        </p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #7f1d1d;">
          Gesture Code: <code>${data.gestureCode}</code>
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Sender:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${data.senderName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Your Relationship:</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${data.relationship}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Time (UTC):</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right;">${time} UTC</td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="https://sakthi-g2005.github.io/voxsign/" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.3);">
          Open VoxSign App to Respond
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center; margin: 16px 0 0;">
        If this is a life-threatening medical emergency, please call your local emergency services immediately.
      </p>
    </div>

    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
      VoxSign · Sign Language & Gesture Emergency Alerting System
    </div>
  </div>
</body>
</html>`;
}

function buildStatusEmailHtml(data: {
  senderName: string;
  statusText: string;
  status: AlertKind;
  message: string;
  time: string;
}): string {
  const badgeColor = data.status === "help_provided" ? "#16a34a" : "#2563eb";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VoxSign Status Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background-color: ${badgeColor}; padding: 18px 24px; color: #ffffff; text-align: center;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700;">VoxSign Emergency Status Update</h2>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">
        Hello ${data.senderName},
      </p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #15803d;">
          ${data.statusText}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Original request: <strong>"${data.message}"</strong> at ${data.time} UTC.
      </p>
    </div>
  </div>
</body>
</html>`;
}
