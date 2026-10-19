"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.actorSelect = void 0;
exports.notify = notify;
exports.clearFollowNotifications = clearFollowNotifications;
const prisma_1 = require("../../config/prisma");
const response_1 = require("../../utils/response");
const socket_1 = require("../../lib/socket");
exports.actorSelect = { id: true, name: true, username: true, avatar: true };
/**
 * Direct messages are surfaced ONLY by the message badge / Messages page,
 * never by the notification bell, so MESSAGE rows are excluded everywhere here.
 */
const bellFilter = { type: { not: "MESSAGE" } };
/** Types that describe the current follow state between two users: only one of them should exist at a time. */
const FOLLOW_STATE_TYPES = ["FOLLOW", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED", "FOLLOW_REJECTED"];
/** Creates a notification, skipping self-notifications (liking your own post, etc.). */
async function notify(input) {
    if (input.recipientId === input.actorId)
        return;
    // Direct messages never create bell notifications (the Messages icon handles them)
    if (input.type === "MESSAGE")
        return;
    // Follow notifications replace each other instead of piling up (follow → unfollow → follow …)
    if (FOLLOW_STATE_TYPES.includes(input.type)) {
        await prisma_1.prisma.notification.deleteMany({
            where: { recipientId: input.recipientId, actorId: input.actorId, type: { in: FOLLOW_STATE_TYPES } },
        });
    }
    const created = await prisma_1.prisma.notification.create({ data: input });
    (0, socket_1.emitToUser)(input.recipientId, "notification:new", { id: created.id, type: created.type });
}
/** Removes the follow-related notifications between two users (used on unfollow / cancel / reject). */
async function clearFollowNotifications(recipientId, actorId, types = FOLLOW_STATE_TYPES) {
    await prisma_1.prisma.notification.deleteMany({ where: { recipientId, actorId, type: { in: types } } });
    (0, socket_1.emitToUser)(recipientId, "notification:changed", {});
}
exports.notificationService = {
    async list(userId, cursor, limit) {
        const rows = await prisma_1.prisma.notification.findMany({
            where: { recipientId: userId, ...bellFilter },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: { actor: { select: exports.actorSelect }, post: { select: { id: true, text: true, image: true } } },
            ...(0, response_1.cursorArgs)(cursor, limit),
        });
        return (0, response_1.toPage)(rows, limit);
    },
    unreadCount: (userId) => prisma_1.prisma.notification.count({ where: { recipientId: userId, read: false, ...bellFilter } }),
    markAllRead: (userId) => prisma_1.prisma.notification.updateMany({ where: { recipientId: userId, read: false, ...bellFilter }, data: { read: true } }),
    markRead: (userId, id) => prisma_1.prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { read: true } }),
    deleteOne: (userId, id) => prisma_1.prisma.notification.deleteMany({ where: { id, recipientId: userId } }),
    clear: (userId) => prisma_1.prisma.notification.deleteMany({ where: { recipientId: userId, ...bellFilter } }),
};
//# sourceMappingURL=notification.service.js.map