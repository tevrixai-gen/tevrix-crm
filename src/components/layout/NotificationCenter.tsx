"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Megaphone, Phone, CheckCircle2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notification {
  id: string;
  icon: "campaign" | "call" | "lead";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      const items: Notification[] = (data.activities ?? []).slice(0, 8).map(
        (a: { id: string; action: string; entityType: string; details: string; createdAt: string }) => ({
          id: a.id,
          icon: a.entityType === "campaign" ? "campaign" : a.entityType === "call" ? "call" : "lead",
          title: a.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: a.details || `${a.entityType} ${a.action}`,
          time: new Date(a.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }),
          read: false,
        })
      );
      setNotifications(items);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const iconMap = {
    campaign: Megaphone,
    call: Phone,
    lead: CheckCircle2,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative inline-flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="top">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
          ) : (
            notifications.map((n) => {
              const Icon = iconMap[n.icon];
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors ${
                    n.read ? "" : "bg-primary/5"
                  }`}
                >
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
