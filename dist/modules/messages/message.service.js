"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageService = void 0;
const prisma_1 = require("../../config/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const notification_service_1 = require("../notifications/notification.service");
const socket_1 = require("../../lib/socket");
const user_service_1 = require("../users/user.service");
async function assertMember(conversationId, userId) {
    const member = await prisma_1.prisma.conversationMember.findUnique({
        where: {
            conversationId_userId: {
                conversationId,
                userId
            }
        },
        select: { userId: true }
    });
    if (!member) {
        throw ApiError_1.ApiError.notFound('Conversation not found');
    }
}
exports.messageService = {
    async conversations(userId) {
        const rows = await prisma_1.prisma.conversation.findMany({
            where: {
                members: { some: { userId } }
            },
            orderBy: { updatedAt: 'desc' },
            distinct: ['id'],
            include: {
                members: {
                    where: { userId: { not: userId } },
                    include: {
                        user: {
                            select: {
                                ...notification_service_1.actorSelect,
                                lastSeenAt: true
                            }
                        }
                    },
                    take: 1
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        const myMemberships = await prisma_1.prisma.conversationMember.findMany({
            where: {
                userId,
                conversationId: {
                    in: rows.map(row => row.id)
                }
            },
            select: {
                conversationId: true,
                lastReadAt: true
            }
        });
        const readMap = new Map(myMemberships.map(membership => [
            membership.conversationId,
            membership.lastReadAt
        ]));
        const seenUsers = new Set();
        const result = [];
        for (const conversation of rows) {
            const other = conversation.members[0]?.user;
            if (!other)
                continue;
            if (seenUsers.has(other.id))
                continue;
            seenUsers.add(other.id);
            const lastReadAt = readMap.get(conversation.id) ?? null;
            const lastMessage = conversation.messages[0] ?? null;
            let unread = 0;
            if (lastMessage &&
                lastMessage.senderId !== userId &&
                (!lastReadAt || lastMessage.createdAt > lastReadAt)) {
                unread = await prisma_1.prisma.message.count({
                    where: {
                        conversationId: conversation.id,
                        senderId: { not: userId },
                        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {})
                    }
                });
            }
            result.push({
                id: conversation.id,
                user: other,
                lastMessage,
                updatedAt: conversation.updatedAt,
                otherLastReadAt: conversation.members[0]?.lastReadAt ?? null,
                unreadCount: unread
            });
        }
        return result;
    },
    /** Total unread messages for the navbar badge. */
    async unreadCount(userId) {
        const memberships = await prisma_1.prisma.conversationMember.findMany({
            where: { userId },
            select: {
                conversationId: true,
                lastReadAt: true
            }
        });
        if (memberships.length === 0)
            return 0;
        let total = 0;
        for (const membership of memberships) {
            const count = await prisma_1.prisma.message.count({
                where: {
                    conversationId: membership.conversationId,
                    senderId: { not: userId },
                    ...(membership.lastReadAt
                        ? {
                            createdAt: {
                                gt: membership.lastReadAt
                            }
                        }
                        : {})
                }
            });
            total += count;
        }
        return total;
    },
    /** Start a new conversation with an authorized user. */
    async start(userId, username) {
        const target = await prisma_1.prisma.user.findUnique({
            where: {
                username: username.toLowerCase()
            },
            select: { id: true }
        });
        if (!target) {
            throw ApiError_1.ApiError.notFound('User not found');
        }
        if (target.id === userId) {
            throw ApiError_1.ApiError.badRequest('You cannot message yourself');
        }
        const allowed = await (0, user_service_1.canMessage)(userId, target.id);
        if (!allowed) {
            throw ApiError_1.ApiError.forbidden('You can only start a conversation with users who follow you or whom you follow (accepted)');
        }
        const existing = await prisma_1.prisma.conversation.findFirst({
            where: {
                AND: [
                    {
                        members: {
                            some: { userId }
                        }
                    },
                    {
                        members: {
                            some: { userId: target.id }
                        }
                    }
                ]
            },
            select: { id: true }
        });
        if (existing)
            return existing;
        return prisma_1.prisma.conversation.create({
            data: {
                members: {
                    create: [{ userId }, { userId: target.id }]
                }
            },
            select: { id: true }
        });
    },
    /** Get paginated messages from an existing conversation. */
    async messages(conversationId, userId, cursor, limit) {
        await assertMember(conversationId, userId);
        const rows = await prisma_1.prisma.message.findMany({
            where: { conversationId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...(0, response_1.cursorArgs)(cursor, limit)
        });
        return (0, response_1.toPage)(rows, limit);
    },
    /** Send a message inside an existing conversation. */
    async send(conversationId, userId, text) {
        await assertMember(conversationId, userId);
        const cleanText = text.trim();
        if (!cleanText) {
            throw ApiError_1.ApiError.badRequest('Message cannot be empty');
        }
        const other = await prisma_1.prisma.conversationMember.findFirst({
            where: {
                conversationId,
                userId: { not: userId }
            },
            select: { userId: true }
        });
        if (!other) {
            throw ApiError_1.ApiError.notFound('Conversation participant not found');
        }
        // Existing conversation members can continue chatting
        // even if their follow relationship changes.
        const [message] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.message.create({
                data: {
                    conversationId,
                    senderId: userId,
                    text: cleanText
                }
            }),
            prisma_1.prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            })
        ]);
        // Realtime push → only the Messages icon / page reacts (no bell notification)
        (0, socket_1.emitToUser)(other.userId, 'message:new', {
            conversationId,
            message
        });
        return message;
    },
    /** Mark a conversation as read for the current user. */
    async markRead(conversationId, userId) {
        await assertMember(conversationId, userId);
        await prisma_1.prisma.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId
                }
            },
            data: {
                lastReadAt: new Date()
            }
        });
        const other = await prisma_1.prisma.conversationMember.findFirst({
            where: { conversationId, userId: { not: userId } },
            select: { userId: true }
        });
        if (other)
            (0, socket_1.emitToUser)(other.userId, 'message:read', { conversationId });
    }
};
//# sourceMappingURL=message.service.js.map