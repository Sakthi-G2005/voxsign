export type Role = "sender" | "receiver";
export type RequestStatus = "sent" | "delivered" | "seen" | "help_provided";
export type LinkStatus = "unlinked" | "pending" | "accepted" | "declined";
export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "seen"
  | "accepted"
  | "declined"
  | "expired";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  email: string | null;
  phone: string | null;
  notify_all_contacts: boolean;
  escalation_timeout_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface TrustedContact {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  contact_name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  priority: number;
  is_primary: boolean;
  is_active: boolean;
  verified: boolean;
  link_status: LinkStatus;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  help_request_id: string;
  sender_id: string;
  receiver_id: string;
  trusted_contact_id: string | null;
  notification_type: string;
  status: NotificationStatus;
  created_at: string;
  delivered_at: string | null;
  seen_at: string | null;
  responded_at: string | null;
}

export const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Brother",
  "Sister",
  "Guardian",
  "Caregiver",
  "Friend",
];

export const LINK_META: Record<LinkStatus, { label: string; className: string }> = {
  unlinked: { label: "No account linked", className: "bg-secondary text-muted-foreground" },
  pending: { label: "Awaiting acceptance", className: "bg-waiting-soft text-waiting-foreground" },
  accepted: { label: "Linked & verified", className: "bg-success-soft text-success" },
  declined: { label: "Declined", className: "bg-emergency-soft text-emergency" },
};

export interface HelpRequest {
  id: string;
  sender_id: string;
  responder_id: string | null;
  assigned_receiver_id: string | null;
  notification_status: NotificationStatus;
  gesture_code: string;
  message: string;
  status: RequestStatus;
  source: string;
  delivered_at: string | null;
  seen_at: string | null;
  helped_at: string | null;
  responder_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface GestureEvent {
  id: string;
  user_id: string;
  device_id: string | null;
  help_request_id: string | null;
  gesture_code: string;
  gesture_message: string;
  sensor_data: Record<string, number> | null;
  source: string;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export const STATUS_ORDER: RequestStatus[] = ["sent", "delivered", "seen", "help_provided"];

export const STATUS_META: Record<
  RequestStatus,
  { label: string; badge: string; dot: string }
> = {
  sent: {
    label: "Sent",
    badge: "bg-emergency-soft text-emergency border-emergency/25",
    dot: "bg-emergency",
  },
  delivered: {
    label: "Delivered",
    badge: "bg-waiting-soft text-waiting-foreground border-waiting/35",
    dot: "bg-waiting",
  },
  seen: {
    label: "Seen",
    badge: "bg-info-soft text-info border-info/25",
    dot: "bg-info",
  },
  help_provided: {
    label: "Help Provided",
    badge: "bg-success-soft text-success border-success/25",
    dot: "bg-success",
  },
};

export const DEMO_GESTURES = [
  {
    code: "HELP",
    message: "I NEED HELP",
    description: "Emergency assistance required right now.",
    tone: "emergency" as const,
  },
  {
    code: "YES",
    message: "YES",
    description: "Answer yes to a question from your caregiver.",
    tone: "success" as const,
  },
  {
    code: "NO",
    message: "NO",
    description: "Answer no to a question from your caregiver.",
    tone: "emergency" as const,
  },
  {
    code: "OK",
    message: "OK",
    description: "Let your caregiver know everything is fine.",
    tone: "success" as const,
  },
  {
    code: "WATER",
    message: "I NEED WATER",
    description: "Ask for a glass of water.",
    tone: "waiting" as const,
  },
  {
    code: "FOOD",
    message: "I NEED FOOD",
    description: "Let your caregiver know you are hungry.",
    tone: "waiting" as const,
  },
  {
    code: "MEDICINE",
    message: "I NEED MEDICINE",
    description: "Request your medicine or tablets.",
    tone: "emergency" as const,
  },
  {
    code: "CALL_ME",
    message: "CALL ME",
    description: "Ask your caregiver to call you.",
    tone: "waiting" as const,
  },
  {
    code: "COME_HERE",
    message: "PLEASE COME HERE",
    description: "Ask your caregiver to come to you.",
    tone: "waiting" as const,
  },
  {
    code: "IM_FINE",
    message: "I'M FINE",
    description: "Reassure your caregiver that you are okay.",
    tone: "success" as const,
  },
];

export function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}