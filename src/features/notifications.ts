import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HelpRequest, NotificationRow, Profile } from "@/lib/domain";

export interface NotificationFeedItem {
  notification: NotificationRow;
  request: HelpRequest | null;
  senderName: string;
}

/** In-app alert inbox for a caregiver: their private notifications, newest first. */
export function useNotificationFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ["notification-feed", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationFeedItem[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("receiver_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as NotificationRow[];
      if (!rows.length) return [];

      const requestIds = [...new Set(rows.map((r) => r.help_request_id))];
      const senderIds = [...new Set(rows.map((r) => r.sender_id))];

      const [{ data: requests }, { data: profiles }] = await Promise.all([
        supabase.from("help_requests").select("*").in("id", requestIds),
        supabase.from("profiles").select("*").in("id", senderIds),
      ]);

      const requestMap = new Map(
        ((requests ?? []) as HelpRequest[]).map((r) => [r.id, r] as const),
      );
      const nameMap = new Map(
        ((profiles ?? []) as Profile[]).map((p) => [p.id, p.full_name] as const),
      );

      return rows.map((notification) => ({
        notification,
        request: requestMap.get(notification.help_request_id) ?? null,
        senderName: nameMap.get(notification.sender_id) || "A sender",
      }));
    },
  });
}

export function isUnread(row: NotificationRow) {
  return row.status === "pending" || row.status === "sent" || row.status === "delivered";
}

/** Mark one alert as read in the caregiver's inbox. */
export function useMarkNotificationSeen(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "seen", seen_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("receiver_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-feed"] });
    },
  });
}

/** Mark every unread alert as read. */
export function useMarkAllNotificationsSeen(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "seen", seen_at: new Date().toISOString() })
        .eq("receiver_id", userId!)
        .in("status", ["pending", "sent", "delivered"]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-feed"] });
    },
  });
}

/**
 * Realtime in-app delivery: any notification row addressed to this caregiver
 * refreshes the inbox instantly, independent of email/SMS delivery.
 */
export function useNotificationsRealtime(
  userId: string | undefined,
  onIncoming?: (row: NotificationRow) => void,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notification-feed"] });
          queryClient.invalidateQueries({ queryKey: ["all-requests"] });
          if (payload.eventType === "INSERT" && onIncoming) {
            onIncoming(payload.new as NotificationRow);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId, onIncoming]);
}
