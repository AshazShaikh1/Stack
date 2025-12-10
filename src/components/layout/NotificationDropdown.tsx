"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Tooltip } from "@/components/ui/Tooltip";
import { NotificationIcon } from "@/components/ui/Icons";

interface Notification {
  id: string;
  type:
    | "follow"
    | "upvote"
    | "comment"
    | "clone"
    | "new_card"
    | "new_collection";
  actor_id: string;
  data: {
    collection_id?: string;
    stack_id?: string; // Legacy support
    collection_title?: string;
    stack_title?: string; // Legacy support
    card_id?: string;
    card_title?: string;
    comment_id?: string;
    comment_content?: string;
  };
  read: boolean;
  created_at: string;
  actor: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface NotificationDropdownProps {
  user: any;
}

export function NotificationDropdown({ user }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          id,
          type,
          actor_id,
          data,
          read,
          created_at,
          actor:users!notifications_actor_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
        setIsLoading(false);
        return;
      }

      const formattedNotifications = (data || []).map((notif: any) => ({
        id: notif.id,
        type: notif.type,
        actor_id: notif.actor_id,
        data: notif.data || {},
        read: notif.read,
        created_at: notif.created_at,
        actor: notif.actor || {},
      }));

      setNotifications(formattedNotifications);
      setUnreadCount(
        formattedNotifications.filter((n: Notification) => !n.read).length
      );
      setIsLoading(false);
    };

    fetchNotifications();

    // Subscribe to real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setIsOpen(false);

    // Redirect based on notification type
    const collectionId =
      notification.data.collection_id || notification.data.stack_id; // Support both

    switch (notification.type) {
      case "follow":
        router.push(`/profile/${notification.actor.username}`);
        break;
      case "upvote":
        // If it's a comment upvote, go to the collection with the comment
        if (notification.data.comment_id && collectionId) {
          router.push(`/collection/${collectionId}`);
        } else if (collectionId) {
          router.push(`/collection/${collectionId}`);
        } else if (notification.data.card_id) {
          router.push(`/card/${notification.data.card_id}`);
        }
        break;
      case "comment":
        if (collectionId) {
          router.push(`/collection/${collectionId}`);
        } else if (notification.data.card_id) {
          router.push(`/card/${notification.data.card_id}`);
        }
        break;
      case "clone":
        if (collectionId) {
          router.push(`/collection/${collectionId}`);
        }
        break;
      case "new_card":
        if (notification.data.card_id) {
          router.push(`/card/${notification.data.card_id}`);
        }
        break;
      case "new_collection":
        if (collectionId) {
          router.push(`/collection/${collectionId}`);
        }
        break;
      default:
        break;
    }
  };

  // Renamed from handleClearAll -> Marks everything as read
  const handleMarkAsRead = async () => {
    if (unreadCount === 0) return;

    setIsMarkingRead(true);

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    } finally {
      setIsMarkingRead(false);
    }
  };

  // New function: Removes all notifications from the UI list
  const handleClearList = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const formatNotificationText = (notification: Notification): string => {
    const actorName = notification.actor?.display_name || "Someone";
    const collectionTitle =
      notification.data.collection_title ||
      notification.data.stack_title ||
      "your collection";

    switch (notification.type) {
      case "follow":
        return `${actorName} started following you`;
      case "upvote":
        // Check if it's an upvote on a comment
        if (notification.data.comment_id) {
          const commentContent = notification.data.comment_content
            ? `"${notification.data.comment_content.substring(0, 50)}${
                notification.data.comment_content.length > 50 ? "..." : ""
              }"`
            : "your comment";
          return `${actorName} liked your ${commentContent} comment`;
        }
        if (notification.data.card_id) {
          return `${actorName} upvoted your card`;
        }
        // Otherwise it's an upvote on a collection
        return `${actorName} upvoted your ${collectionTitle} collection`;
      case "comment":
        if (notification.data.card_id) {
          return `${actorName} commented on your card`;
        }
        return `${actorName} commented on your ${collectionTitle} collection`;
      case "clone":
        return `${actorName} cloned your ${collectionTitle} collection`;
      case "new_card":
        return `${actorName} posted a new card: ${
          notification.data.card_title || "Check it out"
        }`;
      case "new_collection":
        return `${actorName} created a new collection: ${collectionTitle}`;
      default:
        return "New notification";
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip text="Notifications" position="bottom">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-lg hover:bg-gray-light transition-colors focus:outline-none"
          aria-label="Notifications"
        >
          <NotificationIcon size={20} className="text-gray-muted" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-light z-20 overflow-hidden max-h-[500px] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-light flex justify-between items-center bg-white sticky top-0 z-30">
              <h3 className="font-semibold text-jet-dark">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAsRead}
                    disabled={isMarkingRead}
                    className="text-xs text-gray-500 hover:text-emerald font-medium transition-colors px-2 py-1 rounded hover:bg-gray-50"
                  >
                    {isMarkingRead ? "Marking..." : "Mark as read"}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearList}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-4 text-center text-gray-muted">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-muted">
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-light">
                  {notifications.map((notification) => {
                    const actor = notification.actor || {};
                    const initials = getInitials(actor.display_name || "U");

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-light transition-colors text-left ${
                          !notification.read ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {actor.avatar_url ? (
                            <Image
                              src={actor.avatar_url}
                              alt={actor.display_name || "User"}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-jet/20 flex items-center justify-center text-jet font-semibold text-sm">
                              {initials}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body text-jet-dark">
                            {formatNotificationText(notification)}
                          </p>
                          <p className="text-small text-gray-muted mt-1">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
