import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, TrustedContact } from "@/lib/domain";
import { useSpeaker } from "@/features/speaker";

export type AttachmentKind = "audio" | "image" | "video";

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  author_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  attachment_path?: string | null;
  attachment_type?: AttachmentKind | null;
  attachment_mime?: string | null;
  attachment_duration?: number | null;
}

export const CHAT_BUCKET = "chat-media";

/** Signed URL for a private chat attachment. */
export function useAttachmentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["chat-attachment", path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export interface ChatPartner {
  /** sender side of the conversation pair */
  senderId: string;
  /** receiver (caregiver) side of the conversation pair */
  receiverId: string;
  name: string;
  relationship: string;
  isPrimary: boolean;
}

/** Accepted caregiver links the signed-in user can privately chat with. */
export function useChatPartners(profile: Profile | undefined) {
  return useQuery({
    queryKey: ["chat-partners", profile?.id, profile?.role],
    enabled: Boolean(profile),
    queryFn: async (): Promise<ChatPartner[]> => {
      const column = profile!.role === "receiver" ? "receiver_id" : "sender_id";
      const { data, error } = await supabase
        .from("trusted_contacts")
        .select("*")
        .eq(column, profile!.id)
        .eq("link_status", "accepted")
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("priority", { ascending: true });
      if (error) throw error;
      const links = ((data ?? []) as TrustedContact[]).filter((l) => l.receiver_id);

      const names: Record<string, string> = {};
      if (profile!.role === "receiver" && links.length) {
        const ids = [...new Set(links.map((l) => l.sender_id))];
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
        for (const p of (profiles ?? []) as Profile[]) names[p.id] = p.full_name || "Sender";
      }

      return links.map((l) => ({
        senderId: l.sender_id,
        receiverId: l.receiver_id!,
        name: profile!.role === "receiver" ? (names[l.sender_id] ?? "Sender") : l.contact_name,
        relationship: l.relationship,
        isPrimary: l.is_primary,
      }));
    },
  });
}

export function useChatMessages(partner: ChatPartner | undefined) {
  return useQuery({
    queryKey: ["chat-messages", partner?.senderId, partner?.receiverId],
    enabled: Boolean(partner),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("sender_id", partner!.senderId)
        .eq("receiver_id", partner!.receiverId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

export interface SendChatInput {
  body?: string;
  file?: File | Blob;
  kind?: AttachmentKind;
  /** seconds, for voice messages */
  duration?: number;
  filename?: string;
}

export function useSendChatMessage(partner: ChatPartner | undefined, authorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendChatInput) => {
      let attachment_path: string | null = null;
      let attachment_mime: string | null = null;

      if (input.file && input.kind) {
        const mime = input.file.type || "application/octet-stream";
        const ext = (input.filename?.split(".").pop() ?? mime.split("/")[1] ?? "bin")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const path = `${partner!.senderId}/${partner!.receiverId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(CHAT_BUCKET)
          .upload(path, input.file, { contentType: mime, upsert: false });
        if (upErr) throw upErr;
        attachment_path = path;
        attachment_mime = mime;
      }

      const { error } = await supabase.from("chat_messages").insert({
        sender_id: partner!.senderId,
        receiver_id: partner!.receiverId,
        author_id: authorId,
        body: input.body ?? "",
        attachment_path,
        attachment_type: input.kind ?? null,
        attachment_mime,
        attachment_duration: input.duration ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", partner?.senderId, partner?.receiverId],
      }),
  });
}

/** Mark the other person's messages as read. */
export function useMarkChatRead(partner: ChatPartner | undefined, userId: string) {
  return useMutation({
    mutationFn: async () => {
      if (!partner) return;
      await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", partner.senderId)
        .eq("receiver_id", partner.receiverId)
        .neq("author_id", userId)
        .is("read_at", null);
    },
  });
}

export function useChatRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("private-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Speaks incoming private chat messages aloud on the connected speaker from any
 * page in the app (not just the Messages screen).
 */
export function useChatSpeakerAlerts(profile: Profile | undefined) {
  const queryClient = useQueryClient();
  const speaker = useSpeaker();
  const speakRef = useRef(speaker.speak);
  speakRef.current = speaker.speak;

  useEffect(() => {
    if (!profile) return;
    const seen = new Set<string>();
    let primed = false;
    let cancelled = false;

    const handle = (messages: ChatMessage[]) => {
      const fresh = messages.filter((m) => m.author_id !== profile.id && !seen.has(m.id));
      for (const m of messages) seen.add(m.id);
      if (!primed) {
        primed = true;
        return;
      }
      if (!fresh.length) return;
      const latest = fresh.sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)!;
      const label =
        latest.body ||
        (latest.attachment_type === "image"
          ? "sent a photo"
          : latest.attachment_type === "video"
            ? "sent a video"
            : latest.attachment_type === "audio"
              ? "sent a voice message"
              : "");
      speakRef.current(`New message. ${label}`);
    };

    const poll = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      handle(((data ?? []) as ChatMessage[]).slice().reverse());
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 5000);

    const channel = supabase
      .channel(`chat-speaker-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (!msg) return;
          queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
          handle([msg]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [profile, queryClient]);
}
