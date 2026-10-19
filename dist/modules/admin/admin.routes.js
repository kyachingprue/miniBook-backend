"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../config/prisma");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const socket_1 = require("../../lib/socket");
const router = (0, express_1.Router)();
router.use(auth_1.requireAdmin);
const userSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    role: true,
    isActive: true,
    avatar: true,
    createdAt: true,
    emailVerified: true,
    _count: { select: { followers: true, following: true, posts: true } }
};
/** Aggregate daily counts for the last N days from a list of dates. */
function dailyCounts(dates, days) {
    const map = new Map();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const dt of dates) {
        const key = new Date(dt).toISOString().slice(0, 10);
        if (map.has(key))
            map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}
router.get('/overview', async (_req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [users, activeUsers, posts, comments, likes, follows, notifications, registrationDates, postDates, recentUsers] = await Promise.all([
        prisma_1.prisma.user.count(),
        prisma_1.prisma.user.count({ where: { isActive: true } }),
        prisma_1.prisma.post.count(),
        prisma_1.prisma.comment.count(),
        prisma_1.prisma.like.count(),
        prisma_1.prisma.follow.count(),
        prisma_1.prisma.notification.count(),
        prisma_1.prisma.user.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma_1.prisma.post.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma_1.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                avatar: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 8
        })
    ]);
    const onlineIds = (0, socket_1.getOnlineUserIds)();
    (0, response_1.ok)(res, {
        totals: {
            users,
            activeUsers,
            deactivatedUsers: users - activeUsers,
            posts,
            comments,
            likes,
            follows,
            notifications,
            onlineUsers: onlineIds.length
        },
        registrations: dailyCounts(registrationDates.map(r => r.createdAt), 30),
        postTrends: dailyCounts(postDates.map(r => r.createdAt), 30),
        recentUsers,
        onlineUserIds: onlineIds
    });
});
router.get('/analytics', async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const [userDates, postDates, likeCount, commentCount, followCount, totals] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma_1.prisma.post.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma_1.prisma.like.count({ where: { createdAt: { gte: since } } }),
        prisma_1.prisma.comment.count({ where: { createdAt: { gte: since } } }),
        prisma_1.prisma.follow.count({ where: { createdAt: { gte: since } } }),
        Promise.all([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({ where: { isActive: true } }),
            prisma_1.prisma.post.count(),
            prisma_1.prisma.comment.count()
        ])
    ]);
    const onlineIds = (0, socket_1.getOnlineUserIds)();
    (0, response_1.ok)(res, {
        rangeDays: days,
        registrations: dailyCounts(userDates.map(r => r.createdAt), days),
        postTrends: dailyCounts(postDates.map(r => r.createdAt), days),
        engagement: {
            likes: likeCount,
            comments: commentCount,
            follows: followCount
        },
        totals: {
            users: totals[0],
            activeUsers: totals[1],
            deactivatedUsers: totals[0] - totals[1],
            posts: totals[2],
            comments: totals[3],
            onlineUsers: onlineIds.length
        },
        onlineUserIds: onlineIds
    });
});
router.get('/users', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'all');
    const role = String(req.query.role || 'all');
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const where = {
        ...(status === 'active'
            ? { isActive: true }
            : status === 'inactive'
                ? { isActive: false }
                : {}),
        ...(role === 'admin'
            ? {
                OR: [
                    { role: { equals: 'admin', mode: 'insensitive' } },
                    { role: { equals: 'administrator', mode: 'insensitive' } }
                ]
            }
            : role === 'user'
                ? {
                    AND: [
                        { role: { not: 'admin', mode: 'insensitive' } },
                        { role: { not: 'administrator', mode: 'insensitive' } }
                    ]
                }
                : {}),
        ...(q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { username: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                    { id: { contains: q } }
                ]
            }
            : {})
    };
    const orderBy = sort === 'oldest'
        ? { createdAt: 'asc' }
        : sort === 'name'
            ? { name: 'asc' }
            : sort === 'followers'
                ? { followers: { _count: 'desc' } }
                : { createdAt: 'desc' };
    const [items, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where,
            select: userSelect,
            orderBy,
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma_1.prisma.user.count({ where })
    ]);
    const onlineIds = new Set((0, socket_1.getOnlineUserIds)());
    (0, response_1.ok)(res, {
        items: items.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            avatar: u.avatar,
            createdAt: u.createdAt,
            emailVerified: u.emailVerified,
            followersCount: u._count.followers,
            followingCount: u._count.following,
            postsCount: u._count.posts,
            isOnline: onlineIds.has(u.id)
        })),
        total,
        page,
        pages: Math.ceil(total / limit) || 1
    });
});
router.get('/users/:id', (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            ...userSelect,
            bio: true,
            location: true,
            website: true,
            cover: true,
            updatedAt: true
        }
    });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const onlineIds = new Set((0, socket_1.getOnlineUserIds)());
    (0, response_1.ok)(res, {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        avatar: user.avatar,
        cover: user.cover,
        bio: user.bio,
        location: user.location,
        website: user.website,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        emailVerified: user.emailVerified,
        followersCount: user._count.followers,
        followingCount: user._count.following,
        postsCount: user._count.posts,
        isOnline: onlineIds.has(user.id)
    });
});
router.patch('/users/:id/status', (0, validate_1.validate)({ params: response_1.idParam, body: zod_1.z.object({ isActive: zod_1.z.boolean() }) }), async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user?.id && !req.body.isActive) {
        return res.status(400).json({
            success: false,
            message: 'You cannot deactivate your own account.'
        });
    }
    if (!req.body.isActive) {
        const target = await prisma_1.prisma.user.findUnique({
            where: { id: targetId },
            select: { role: true }
        });
        const isAdmin = target && ['admin', 'administrator'].includes(target.role.toLowerCase());
        if (isAdmin) {
            const adminCount = await prisma_1.prisma.user.count({
                where: {
                    isActive: true,
                    OR: [
                        { role: { equals: 'admin', mode: 'insensitive' } },
                        { role: { equals: 'administrator', mode: 'insensitive' } }
                    ]
                }
            });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate the last active administrator.'
                });
            }
        }
    }
    const user = await prisma_1.prisma.user.update({
        where: { id: targetId },
        data: { isActive: req.body.isActive },
        select: {
            id: true,
            name: true,
            username: true,
            isActive: true,
            role: true
        }
    });
    try {
        const { broadcastAdminEvent } = await import('../../lib/socket.js');
        broadcastAdminEvent('user:status', {
            id: user.id,
            isActive: user.isActive
        });
    }
    catch {
        /* socket optional */
    }
    (0, response_1.ok)(res, user);
});
router.delete('/users/:id', (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user?.id) {
        return res.status(400).json({
            success: false,
            message: 'You cannot delete your own account.'
        });
    }
    const target = await prisma_1.prisma.user.findUnique({
        where: { id: targetId },
        select: { role: true }
    });
    if (!target) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isAdmin = ['admin', 'administrator'].includes(target.role.toLowerCase());
    if (isAdmin) {
        const adminCount = await prisma_1.prisma.user.count({
            where: {
                isActive: true,
                OR: [
                    { role: { equals: 'admin', mode: 'insensitive' } },
                    { role: { equals: 'administrator', mode: 'insensitive' } }
                ]
            }
        });
        if (adminCount <= 1) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete the last administrator.'
            });
        }
    }
    await prisma_1.prisma.user.delete({ where: { id: targetId } });
    try {
        const { broadcastAdminEvent } = await import('../../lib/socket.js');
        broadcastAdminEvent('user:deleted', { id: targetId });
    }
    catch {
        /* optional */
    }
    (0, response_1.message)(res, 'User deleted');
});
router.get('/posts', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const q = String(req.query.q || '').trim();
    const where = q
        ? {
            OR: [
                { text: { contains: q, mode: 'insensitive' } },
                {
                    author: { username: { contains: q, mode: 'insensitive' } }
                }
            ]
        }
        : {};
    const [items, total] = await Promise.all([
        prisma_1.prisma.post.findMany({
            where,
            select: {
                id: true,
                text: true,
                image: true,
                video: true,
                shares: true,
                createdAt: true,
                author: {
                    select: { id: true, name: true, username: true, avatar: true }
                },
                _count: { select: { likes: true, comments: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma_1.prisma.post.count({ where })
    ]);
    (0, response_1.ok)(res, {
        items: items.map(p => ({
            id: p.id,
            text: p.text,
            image: p.image,
            video: p.video,
            shares: p.shares,
            createdAt: p.createdAt,
            author: p.author,
            likesCount: p._count.likes,
            commentsCount: p._count.comments
        })),
        total,
        page,
        pages: Math.ceil(total / limit) || 1
    });
});
router.delete('/posts/:id', (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await prisma_1.prisma.post.delete({ where: { id: req.params.id } });
    (0, response_1.message)(res, 'Post deleted');
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map