"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postService = exports.toPostDto = void 0;
const prisma_1 = require("../../config/prisma");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const cloudinary_1 = require("../../lib/cloudinary");
const notification_service_1 = require("../notifications/notification.service");
/** What to load for every post. `viewerId` powers the liked / bookmarked flags. */
const postInclude = (viewerId) => ({
    author: { select: notification_service_1.actorSelect },
    _count: { select: { likes: true, comments: true } },
    likes: {
        where: { userId: viewerId ?? '' },
        select: { userId: true },
        take: 1
    },
    bookmarks: {
        where: { userId: viewerId ?? '' },
        select: { userId: true },
        take: 1
    }
});
const toPostDto = (p) => ({
    id: p.id,
    text: p.text,
    image: p.image,
    video: p.video && p.videoPublicId
        ? {
            url: p.video,
            thumbnail: (0, cloudinary_1.videoThumbnailUrl)(p.videoPublicId),
            duration: p.videoDuration
        }
        : null,
    visibility: p.visibility,
    createdAt: p.createdAt,
    author: p.author,
    likesCount: p._count.likes,
    commentsCount: p._count.comments,
    sharesCount: p.shares,
    liked: p.likes.length > 0,
    bookmarked: p.bookmarks.length > 0
});
exports.toPostDto = toPostDto;
const orderBy = [
    { createdAt: 'desc' },
    { id: 'desc' }
];
async function assertPost(id) {
    const post = await prisma_1.prisma.post.findUnique({
        where: { id },
        select: { id: true, authorId: true }
    });
    if (!post)
        throw ApiError_1.ApiError.notFound('Post not found');
    return post;
}
/** "hi @sara and @liam" -> notify sara and liam */
async function notifyMentions(text, actorId, postId) {
    const names = [
        ...new Set([...text.matchAll(/@([a-z0-9_]{3,20})/gi)].map(m => m[1].toLowerCase()))
    ];
    if (names.length === 0)
        return;
    const users = await prisma_1.prisma.user.findMany({
        where: { username: { in: names } },
        select: { id: true }
    });
    await Promise.all(users.map(u => (0, notification_service_1.notify)({ recipientId: u.id, actorId, type: 'MENTION', postId })));
}
exports.postService = {
    async list(opts) {
        const { viewerId, cursor, limit, scope, q, username } = opts;
        // Visibility rules (enforced on backend):
        // PUBLIC  → everyone
        // FRIENDS → accepted mutual connection (viewer is accepted follower of author)
        // PRIVATE → only the author
        const visibilityFilter = viewerId
            ? {
                OR: [
                    { visibility: 'PUBLIC' },
                    { authorId: viewerId },
                    {
                        visibility: 'FRIENDS',
                        author: {
                            followers: {
                                some: { followerId: viewerId, status: 'ACCEPTED' }
                            }
                        }
                    }
                ]
            }
            : { visibility: 'PUBLIC' };
        const where = {
            AND: [
                visibilityFilter,
                {
                    ...(username && { author: { username } }),
                    ...(scope === 'following' &&
                        viewerId && {
                        author: {
                            followers: {
                                some: { followerId: viewerId, status: 'ACCEPTED' }
                            }
                        }
                    }),
                    ...(q && {
                        OR: [
                            { text: { contains: q, mode: 'insensitive' } },
                            { author: { username: { contains: q, mode: 'insensitive' } } },
                            { author: { name: { contains: q, mode: 'insensitive' } } }
                        ]
                    })
                }
            ]
        };
        const rows = await prisma_1.prisma.post.findMany({
            where,
            orderBy,
            include: postInclude(viewerId),
            ...(0, response_1.cursorArgs)(cursor, limit)
        });
        const page = (0, response_1.toPage)(rows, limit);
        return { items: page.items.map(exports.toPostDto), nextCursor: page.nextCursor };
    },
    async bookmarks(viewerId, cursor, limit) {
        const rows = await prisma_1.prisma.post.findMany({
            where: { bookmarks: { some: { userId: viewerId } } },
            orderBy,
            include: postInclude(viewerId),
            ...(0, response_1.cursorArgs)(cursor, limit)
        });
        const page = (0, response_1.toPage)(rows, limit);
        return { items: page.items.map(exports.toPostDto), nextCursor: page.nextCursor };
    },
    async get(id, viewerId) {
        const post = await prisma_1.prisma.post.findUnique({
            where: { id },
            include: postInclude(viewerId)
        });
        if (!post)
            throw ApiError_1.ApiError.notFound('Post not found');
        // Enforce visibility
        if (post.visibility === 'PRIVATE' && post.authorId !== viewerId) {
            throw ApiError_1.ApiError.forbidden('This post is private');
        }
        if (post.visibility === 'FRIENDS') {
            if (!viewerId || post.authorId !== viewerId) {
                const follow = viewerId
                    ? await prisma_1.prisma.follow.findUnique({
                        where: {
                            followerId_followingId: {
                                followerId: viewerId,
                                followingId: post.authorId
                            }
                        },
                        select: { status: true }
                    })
                    : null;
                if (follow?.status !== 'ACCEPTED') {
                    throw ApiError_1.ApiError.forbidden('This post is only visible to friends');
                }
            }
        }
        return (0, exports.toPostDto)(post);
    },
    async create(authorId, data) {
        // Cloudinary is asked what was really uploaded (owner, size, duration) before the post is saved
        const video = data.videoPublicId
            ? await (0, cloudinary_1.verifyUploadedVideo)(authorId, data.videoPublicId)
            : null;
        const post = await prisma_1.prisma.post.create({
            data: {
                text: data.text,
                image: data.image,
                authorId,
                visibility: data.visibility ?? 'PUBLIC',
                ...(video && {
                    video: video.url,
                    videoPublicId: data.videoPublicId,
                    videoDuration: video.duration
                })
            },
            include: postInclude(authorId)
        });
        await notifyMentions(data.text, authorId, post.id);
        return (0, exports.toPostDto)(post);
    },
    async update(id, userId, text) {
        const post = await prisma_1.prisma.post.findUnique({
            where: { id },
            select: { authorId: true }
        });
        if (!post)
            throw ApiError_1.ApiError.notFound('Post not found');
        if (post.authorId !== userId)
            throw ApiError_1.ApiError.forbidden('You can only edit your own posts');
        const updated = await prisma_1.prisma.post.update({
            where: { id },
            data: { text },
            include: postInclude(userId)
        });
        return (0, exports.toPostDto)(updated);
    },
    async remove(id, userId) {
        const post = await prisma_1.prisma.post.findUnique({
            where: { id },
            select: { authorId: true, videoPublicId: true }
        });
        if (!post)
            throw ApiError_1.ApiError.notFound('Post not found');
        if (post.authorId !== userId)
            throw ApiError_1.ApiError.forbidden('You can only delete your own posts');
        await prisma_1.prisma.post.delete({ where: { id } });
        if (post.videoPublicId)
            void (0, cloudinary_1.deleteVideo)(post.videoPublicId); // free the Cloudinary storage (best effort)
    },
    async like(id, userId) {
        const post = await assertPost(id);
        const { count } = await prisma_1.prisma.like.createMany({
            data: [{ userId, postId: id }],
            skipDuplicates: true
        });
        if (count > 0)
            await (0, notification_service_1.notify)({
                recipientId: post.authorId,
                actorId: userId,
                type: 'LIKE',
                postId: id
            });
        return {
            liked: true,
            likesCount: await prisma_1.prisma.like.count({ where: { postId: id } })
        };
    },
    async unlike(id, userId) {
        await assertPost(id);
        await prisma_1.prisma.like.deleteMany({ where: { userId, postId: id } });
        return {
            liked: false,
            likesCount: await prisma_1.prisma.like.count({ where: { postId: id } })
        };
    },
    async bookmark(id, userId) {
        await assertPost(id);
        await prisma_1.prisma.bookmark.createMany({
            data: [{ userId, postId: id }],
            skipDuplicates: true
        });
        return { bookmarked: true };
    },
    async unbookmark(id, userId) {
        await prisma_1.prisma.bookmark.deleteMany({ where: { userId, postId: id } });
        return { bookmarked: false };
    },
    async share(id) {
        await assertPost(id);
        const post = await prisma_1.prisma.post.update({
            where: { id },
            data: { shares: { increment: 1 } },
            select: { shares: true }
        });
        return { sharesCount: post.shares };
    },
    /** Top hashtags across all posts (powers the "Trending" card). */
    async trending() {
        const rows = await prisma_1.prisma.$queryRaw `
      SELECT lower(m[1]) AS tag, count(*) AS posts
      FROM "Post", regexp_matches("text", '#([A-Za-z0-9_]+)', 'g') AS m
      GROUP BY 1
      ORDER BY posts DESC, tag ASC
      LIMIT 10`;
        return rows.map(r => ({ tag: r.tag, posts: Number(r.posts) }));
    },
    // ───────────── comments ─────────────
    async comments(postId, cursor, limit) {
        await assertPost(postId);
        const rows = await prisma_1.prisma.comment.findMany({
            where: { postId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: { author: { select: notification_service_1.actorSelect } },
            ...(0, response_1.cursorArgs)(cursor, limit)
        });
        return (0, response_1.toPage)(rows, limit);
    },
    async addComment(postId, userId, text, parentId) {
        const post = await assertPost(postId);
        let recipientId = post.authorId;
        if (parentId) {
            const parent = await prisma_1.prisma.comment.findUnique({
                where: { id: parentId },
                select: { id: true, postId: true, parentId: true, authorId: true }
            });
            if (!parent || parent.postId !== postId)
                throw ApiError_1.ApiError.badRequest('Reply target does not belong to this post');
            if (parent.parentId)
                throw ApiError_1.ApiError.badRequest('Replies can only target top-level comments');
            recipientId = parent.authorId;
        }
        const comment = await prisma_1.prisma.comment.create({
            data: {
                postId,
                authorId: userId,
                text,
                ...(parentId ? { parentId } : {})
            },
            include: { author: { select: notification_service_1.actorSelect } }
        });
        await (0, notification_service_1.notify)({ recipientId, actorId: userId, type: 'COMMENT', postId });
        return comment;
    },
    async removeComment(commentId, userId) {
        const comment = await prisma_1.prisma.comment.findUnique({
            where: { id: commentId },
            select: { authorId: true, post: { select: { authorId: true } } }
        });
        if (!comment)
            throw ApiError_1.ApiError.notFound('Comment not found');
        // The comment's author or the post's author may delete it
        if (comment.authorId !== userId && comment.post.authorId !== userId)
            throw ApiError_1.ApiError.forbidden();
        await prisma_1.prisma.comment.delete({ where: { id: commentId } });
    }
};
//# sourceMappingURL=post.service.js.map