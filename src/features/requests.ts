import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { notifyCaregiversOfRequest, notifySenderOfStatus } from "@/lib/alerts.functions";
import { supabase } from "@/integrations/supabase/client";
import type { GestureEvent, HelpRequest, Profile, RequestStatus } from "@/lib/domain";

export function useMyRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-requests", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HelpRequest[]> => {
      const { data, error } = await supabase
        .from("help_requests")
        .select("*")
        .eq("sender_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HelpRequest[];
    },
  });
}

export function useAllRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["all-requests"],
    enabled,
    queryFn: async (): Promise<{ requests: HelpRequest[]; senders: Record<string, Profile> }> => {
      const { data, error } = await supabase
        .from("help_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const requests = (data ?? []) as HelpRequest[];
      const ids = [...new Set(requests.map((r) => r.sender_id))];
      const senders: Record<string, Profile> = {};
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
        for (const p of (profiles ?? []) as Profile[]) senders[p.id] = p;
      }
      return { requests, senders };
    },
  });
}

export function useGestureEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["gesture-events", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<GestureEvent[]> => {
      const { data, error } = await supabase
        .from("gesture_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as GestureEvent[];
    },
  });
}

export function useSendGesture(userId: string | undefined) {
  const queryClient = useQueryClient();
  const notifyCaregivers = useServerFn(notifyCaregiversOfRequest);
  return useMutation({
    mutationFn: async (input: { code: string; message: string }) => {
      const { data: request, error } = await supabase
        .from("help_requests")
        .insert({
          sender_id: userId!,
          gesture_code: input.code,
          message: input.message,
          status: "sent",
          source: "app",
        })
        .select("*")
        .single();
      if (error) throw error;

      const { error: eventError } = await supabase.from("gesture_events").insert({
        user_id: userId!,
        help_request_id: request.id,
        gesture_code: input.code,
        gesture_message: input.message,
        source: "app",
        sensor_data: {},
      });
      if (eventError) throw eventError;

      // Fire outbound alerts (SMS & Email) via server function
      try {
        await notifyCaregivers({ data: { requestId: request.id } });
      } catch (alertError) {
        console.warn("[alerts] server alerts skipped or failed", alertError);
      }

      // Also dispatch client-side emergency alert (handles native SMS/Email launcher and webhooks)
      try {
        const { data: contacts } = await supabase
          .from("trusted_contacts")
          .select("*")
          .eq("sender_id", userId!)
          .eq("is_active", true);

        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId!)
          .maybeSingle();

        const currentLang =
          typeof window !== "undefined" && localStorage.getItem("voxsign_language") === "ta"
            ? "ta"
            : "en";

        const { dispatchClientEmergencyAlert } = await import("@/lib/notifications");
        await dispatchClientEmergencyAlert({
          requestId: request.id,
          senderName: senderProfile?.full_name || "Someone",
          gestureCode: input.code,
          gestureMessage: input.message,
          contacts: (contacts ?? []) as unknown as TrustedContact[],
          language: currentLang,
        });
      } catch (clientAlertError) {
        console.warn("[alerts] client emergency dispatch error", clientAlertError);
      }
      return request as HelpRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["gesture-events"] });
    },
  });
}

export function useUpdateRequestStatus(userId: string | undefined) {
  const queryClient = useQueryClient();
  const notifyStatus = useServerFn(notifySenderOfStatus);
  return useMutation({
    mutationFn: async (input: { id: string; status: RequestStatus }) => {
      const patch: {
        status: RequestStatus;
        delivered_at?: string;
        seen_at?: string;
        helped_at?: string;
        responder_id?: string;
      } = { status: input.status };
      const now = new Date().toISOString();
      if (input.status === "delivered") patch.delivered_at = now;
      if (input.status === "seen") patch.seen_at = now;
      if (input.status === "help_provided") {
        patch.helped_at = now;
        if (userId) patch.responder_id = userId;
      }
      const { error } = await supabase.from("help_requests").update(patch).eq("id", input.id);
      if (error) throw error;

      try {
        await notifyStatus({ data: { requestId: input.id, status: input.status } });
      } catch (alertError) {
        console.error("[alerts] status SMS failed", alertError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    },
  });
}

/** Subscribe to realtime help_request changes and refresh the relevant caches. */
export function useRequestsRealtime(onInsert?: (row: HelpRequest) => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("help-requests-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["all-requests"] });
          queryClient.invalidateQueries({ queryKey: ["my-requests"] });
          if (payload.eventType === "INSERT" && onInsert) {
            onInsert(payload.new as HelpRequest);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, onInsert]);
}