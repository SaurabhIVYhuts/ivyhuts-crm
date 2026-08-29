// Wraps GET /api/notifications and PATCH /api/notifications/:id on the
// IVYHUTS backend (api/notifications/index.js, .../[id]/index.js).
// Contract verified directly against that source (Milestone 23.14).
import { apiRequest } from "./client";
import type { PaginationMeta } from "@/types/api";
import type { Notification } from "@/types/notification";

// Not a plain ApiCollectionResponse — this endpoint adds unreadCount
// alongside the paginated list, so it gets its own response shape rather
// than forcing an ill-fitting reuse of the shared envelope.
export interface NotificationsResponse {
  success: true;
  data: Notification[];
  pagination: PaginationMeta;
  unreadCount: number;
}

export function listNotifications(unreadOnly?: boolean) {
  return apiRequest<NotificationsResponse>("/api/notifications", {
    method: "GET",
    query: unreadOnly ? { unreadOnly: "true" } : undefined,
  });
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ success: true; data: Notification }>(`/api/notifications/${notificationId}`, {
    method: "PATCH",
  });
}
