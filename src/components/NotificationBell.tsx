import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  isUnread,
  useMarkAllNotificationsSeen,
  useMarkNotificationSeen,
  useNotificationFeed,
  useNotificationsRealtime,
} from "@/features/notifications";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ userId }: { userId: string }) {
  const { data: items = [] } = useNotificationFeed(userId);
  const markSeen = useMarkNotificationSeen(userId);
  const markAll = useMarkAllNotificationsSeen(userId);

  const onIncoming = useCallback(() => {
    toast.error("Emergency alert", {
      description: "A linked sender needs help right now.",
    });
  }, []);
  useNotificationsRealtime(userId, onIncoming);

  const unreadCount = useMemo(
    () => items.filter((item) => isUnread(item.notification)).length,
    [items],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative shrink-0" aria-label="Alerts">
          {unreadCount > 0 ? (
            <BellRing className="h-4 w-4 text-emergency" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emergency px-1 text-[10px] font-semibold text-emergency-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Alerts</p>
          {unreadCount > 0 ? (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No alerts yet. Emergency requests from your linked senders appear here instantly.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border">
              {items.map(({ notification, request, senderName }) => {
                const unread = isUnread(notification);
                return (
                  <li key={notification.id}>
                    <Link
                      to="/requests"
                      onClick={() => {
                        if (unread) markSeen.mutate(notification.id);
                      }}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-muted/60",
                        unread && "bg-emergency-soft/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {senderName}
                          {unread ? (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emergency align-middle" />
                          ) : null}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(notification.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {request?.message || "Needs help"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
