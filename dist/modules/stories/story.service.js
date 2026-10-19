"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyService = void 0;
const prisma_1 = require("../../config/prisma");
const ApiError_1 = require("../../utils/ApiError");
const STORY_TTL_HOURS = 24;
const publicUser = {
    id: true,
    name: true,
    username: true,
    avatar: true
};
exports.storyService = {
    async listFeed(viewerId) {
        const now = new Date();
        // Get accepted followers
        const followingIds = (await prisma_1.prisma.follow.findMany({
            where: {
                followerId: viewerId,
                status: 'ACCEPTED'
            },
            select: {
                followingId: true
            }
        })).map(f => f.followingId);
        const authorIds = [...new Set([viewerId, ...followingIds])];
        // Fetch active stories
        const stories = await prisma_1.prisma.story.findMany({
            where: {
                authorId: { in: authorIds },
                expiresAt: { gt: now }
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: {
                    select: publicUser
                },
                views: {
                    where: { userId: viewerId },
                    select: { userId: true },
                    take: 1
                }
            }
        });
        // Group stories by author
        const byAuthor = new Map();
        for (const story of stories) {
            const list = byAuthor.get(story.authorId) ?? [];
            list.push(story);
            byAuthor.set(story.authorId, list);
        }
        // Return grouped stories safely
        return Array.from(byAuthor.entries())
            .filter(([, items]) => items.length > 0)
            .map(([authorId, items]) => {
            const firstStory = items[0];
            return {
                author: firstStory.author,
                hasUnviewed: items.some(item => item.views.length === 0 && item.authorId !== viewerId),
                stories: items.map(story => ({
                    id: story.id,
                    mediaUrl: story.mediaUrl,
                    mediaType: story.mediaType,
                    caption: story.caption,
                    createdAt: story.createdAt,
                    expiresAt: story.expiresAt,
                    viewed: story.views.length > 0 || story.authorId === viewerId
                }))
            };
        });
    },
    async create(authorId, data) {
        if (!['image', 'video'].includes(data.mediaType)) {
            throw ApiError_1.ApiError.badRequest('mediaType must be image or video');
        }
        const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);
        return prisma_1.prisma.story.create({
            data: {
                authorId,
                mediaUrl: data.mediaUrl,
                mediaType: data.mediaType,
                caption: data.caption?.slice(0, 200) || null,
                expiresAt
            },
            include: {
                author: {
                    select: publicUser
                }
            }
        });
    },
    async markViewed(storyId, userId) {
        const story = await prisma_1.prisma.story.findUnique({
            where: { id: storyId },
            select: {
                id: true,
                authorId: true
            }
        });
        if (!story) {
            throw ApiError_1.ApiError.notFound('Story not found');
        }
        if (story.authorId === userId)
            return;
        await prisma_1.prisma.storyView.upsert({
            where: {
                storyId_userId: {
                    storyId,
                    userId
                }
            },
            create: {
                storyId,
                userId
            },
            update: {}
        });
    },
    async delete(storyId, userId) {
        const story = await prisma_1.prisma.story.findUnique({
            where: { id: storyId },
            select: {
                authorId: true
            }
        });
        if (!story) {
            throw ApiError_1.ApiError.notFound('Story not found');
        }
        if (story.authorId !== userId) {
            throw ApiError_1.ApiError.forbidden('Not your story');
        }
        await prisma_1.prisma.story.delete({
            where: { id: storyId }
        });
    }
};
//# sourceMappingURL=story.service.js.map