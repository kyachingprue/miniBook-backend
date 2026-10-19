import type { NotificationType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { cursorArgs, toPage } from "../../utils/response";
import { emitToUser } from "../../lib/socket";

export const actorSelect = { id: true, name: true, username: true, avatar: true } as const;

/**
 * Direct messages are surfaced ONLY by the message badge / Messages page,
 * never by the notification bell, so MESSAGE rows are excluded everywhere here.
 */
const bellFilter = { type: { not: "MESSAGE" as NotificationType } };

/** Types that describe the current follow state between two users: only one of them should exist at a time. */
const FOLLOW_STATE_TYPES: NotificationType[] = ["FOLLOW", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED", "FOLLOW_REJECTED"];

/** Creates a notification, skipping self-notifications (liking your own post, etc.). */
export async function notify(input: { recipientId: string; actorId: string; type: NotificationType; postId?: string }) {
  if (input.recipientId === input.actorId) return;
  // Direct messages never create bell notifications (the Messages icon handles them)
  if (input.type === "MESSAGE") return;
  // Follow notifications replace each other instead of piling up (follow → unfollow → follow …)
  if (FOLLOW_STATE_TYPES.includes(input.type)) {
    await prisma.notification.deleteMany({
      where: { recipientId: input.recipientId, actorId: input.actorId, type: { in: FOLLOW_STATE_TYPES } },
    });
  }
  const created = await prisma.notification.create({ data: input });
  emitToUser(input.recipientId, "notification:new", { id: created.id, type: created.type });
}

/** Removes the follow-related notifications between two users (used on unfollow / cancel / reject). */
export async function clearFollowNotifications(recipientId: string, actorId: string, types: NotificationType[] = FOLLOW_STATE_TYPES) {
  await prisma.notification.deleteMany({ where: { recipientId, actorId, type: { in: types } } });
  emitToUser(recipientId, "notification:changed", {});
}

export const notificationService = {
  async list(userId: string, cursor: string | undefined, limit: number) {
    const rows = await prisma.notification.findMany({
      where: { recipientId: userId, ...bellFilter },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { actor: { select: actorSelect }, post: { select: { id: true, text: true, image: true } } },
      ...cursorArgs(cursor, limit),
    });
    return toPage(rows, limit);
  },

  unreadCount: (userId: string) => prisma.notification.count({ where: { recipientId: userId, read: false, ...bellFilter } }),

  markAllRead: (userId: string) =>
    prisma.notification.updateMany({ where: { recipientId: userId, read: false, ...bellFilter }, data: { read: true } }),

  markRead: (userId: string, id: string) =>
    prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { read: true } }),

  deleteOne: (userId: string, id: string) => prisma.notification.deleteMany({ where: { id, recipientId: userId } }),

  clear: (userId: string) => prisma.notification.deleteMany({ where: { recipientId: userId, ...bellFilter } }),
};
