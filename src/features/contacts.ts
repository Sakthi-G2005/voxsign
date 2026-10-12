import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveTrustedContactAccount } from "@/lib/contacts.functions";
import { escalateHelpRequest } from "@/lib/escalation.functions";
import type { NotificationRow, Profile, TrustedContact } from "@/lib/domain";

export interface ContactInput {
  contact_name: string;
  relationship: string;
  phone: string;
  email: string;
  priority: number;
  is_primary: boolean;
}

export function useTrustedContacts(senderId: string | undefined) {
  return useQuery({
    queryKey: ["trusted-contacts", senderId],
    enabled: Boolean(senderId),
    queryFn: async (): Promise<TrustedContact[]> => {
      const { data, error } = await supabase
        .from("trusted_contacts")
        .select("*")
        .eq("sender_id", senderId!)
        .order("is_primary", { ascending: false })
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrustedContact[];
    },
  });
}

export function useAddTrustedContact(senderId: string | undefined) {
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveTrustedContactAccount);
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      if (input.is_primary) {
        await supabase
          .from("trusted_contacts")
          .update({ is_primary: false })
          .eq("sender_id", senderId!);
      }
      const { data, error } = await supabase
        .from("trusted_contacts")
        .insert({
          sender_id: senderId!,
          contact_name: input.contact_name,
          relationship: input.relationship,
          phone: input.phone || null,
          email: input.email || null,
          priority: input.priority,
          is_primary: input.is_primary,
        })
        .select("id")
        .single();
      if (error) throw error;
      const result = await resolve({ data: { contactId: data.id } });
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trusted-contacts"] }),
  });
}

export function useUpdateTrustedContact(senderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<TrustedContact> }) => {
      if (input.patch.is_primary) {
        await supabase
          .from("trusted_contacts")
          .update({ is_primary: false })
          .eq("sender_id", senderId!);
      }
      const { error } = await supabase
        .from("trusted_contacts")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trusted-contacts"] }),
  });
}

export function useDeleteTrustedContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trusted-contacts"] }),
  });
}

/** Caregiver side: link requests pointing at the signed-in receiver. */
export function useCaregiverLinks(receiverId: string | undefined) {
  return useQuery({
    queryKey: ["caregiver-links", receiverId],
    enabled: Boolean(receiverId),
    queryFn: async (): Promise<{ links: TrustedContact[]; senders: Record<string, Profile> }> => {
      const { data, error } = await supabase
        .from("trusted_contacts")
        .select("*")
        .eq("receiver_id", receiverId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const links = (data ?? []) as TrustedContact[];
      const ids = [...new Set(links.map((l) => l.sender_id))];
      const senders: Record<string, Profile> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
        for (const p of (profiles ?? []) as Profile[]) senders[p.id] = p;
      }
      return { links, senders };
    },
  });
}

export function useRespondToLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from("trusted_contacts")
        .update(
          input.accept
            ? { link_status: "accepted", verified: true, is_active: true }
            : { link_status: "declined", verified: false },
        )
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caregiver-links"] });
      queryClient.invalidateQueries({ queryKey: ["trusted-contacts"] });
    },
  });
}

export function useMyNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { helpRequestId: string; status: "seen" | "accepted" }) => {
      const now = new Date().toISOString();
      const patch =
        input.status === "seen"
          ? { status: "seen" as const, seen_at: now, delivered_at: now }
          : { status: "accepted" as const, responded_at: now };
      const { error } = await supabase
        .from("notifications")
        .update(patch)
        .eq("help_request_id", input.helpRequestId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Escalate to the next trusted caregiver when the current one has not responded. */
export function useEscalateRequest() {
  const queryClient = useQueryClient();
  const escalate = useServerFn(escalateHelpRequest);
  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await escalate({ data: { requestId } });
      return result.escalated;
    },
    onSuccess: (escalated) => {
      if (escalated) {
        queryClient.invalidateQueries({ queryKey: ["my-requests"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    },
  });
}

/** Realtime for private caregiver notifications and link requests. */
export function useContactsRealtime(onNotification?: (row: NotificationRow) => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("caregiver-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["all-requests"] });
        queryClient.invalidateQueries({ queryKey: ["my-requests"] });
        if (payload.eventType === "INSERT" && onNotification) {
          onNotification(payload.new as NotificationRow);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trusted_contacts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["trusted-contacts"] });
        queryClient.invalidateQueries({ queryKey: ["caregiver-links"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, onNotification]);
}
