// Server-only outbound alerting (SMS via Twilio connector gateway).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type AlertKind = "sent" | "delivered" | "seen" | "help_provided";

function smsConfig(): { lovableKey: string; twilioKey: string; from: string } | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!lovableKey || !twilioKey || !from) return null;
  return { lovableKey, twilioKey, from };
}

/** Sends one SMS. Returns false (without throwing) when messaging is not configured or refused. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const config = smsConfig();
  if (!config) {
    console.warn("[alerts] SMS skipped: Twilio sender not configured");
    return false;
  }
  const cleaned = to.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+") || cleaned.length < 8) {
    console.warn("[alerts] SMS skipped: recipient number is not in +country format");
    return false;
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
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
      console.error(`[alerts] Twilio request failed [${response.status}]: ${errorBody}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[alerts] Twilio request threw", error);
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
  message: string;
  createdAt: string;
  contacts: { name: string; relationship: string; phone: string | null; email: string | null }[];
  senderPhone: string | null;
  senderEmail: string | null;
}

async function loadTargets(requestId: string): Promise<AlertTargets | null> {
  const { data: request } = await supabaseAdmin
    .from("help_requests")
    .select("id, sender_id, message, created_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const { data: sender } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", request.sender_id)
    .maybeSingle();

  // Only caregivers actually notified for this request (private routing, never a broadcast).
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

  return {
    senderName: sender?.full_name?.trim() || "Someone",
    message: request.message,
    createdAt: request.created_at,
    contacts,
    senderPhone: sender?.phone ?? null,
    senderEmail: sender?.email ?? null,
  };
}

/** Texts every caregiver who was privately notified about this emergency. */
export async function alertCaregiversOfRequest(requestId: string): Promise<{ sms: number }> {
  const targets = await loadTargets(requestId);
  if (!targets) return { sms: 0 };

  let sms = 0;
  for (const contact of targets.contacts) {
    if (!contact.phone) continue;
    const body = `EMERGENCY HELP REQUEST\n${targets.senderName} needs help.\n"${targets.message}"\nRelationship: ${contact.relationship}\nTime: ${timeLabel(targets.createdAt)} UTC\nOpen the Gesture-to-Help app to respond.`;
    if (await sendSms(contact.phone, body)) sms += 1;
  }
  return { sms };
}

/** Texts the sender when a caregiver moves the request forward. */
export async function alertSenderOfStatus(requestId: string, status: AlertKind): Promise<boolean> {
  const targets = await loadTargets(requestId);
  if (!targets?.senderPhone) return false;

  const text =
    status === "help_provided"
      ? "Help is on the way — your caregiver is coming."
      : status === "seen"
        ? "Your caregiver has seen your emergency request."
        : "Your emergency request was delivered to your caregiver.";
  return sendSms(targets.senderPhone, `Gesture-to-Help update\n${text}`);
}
