"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../config/prisma");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(3).max(60),
    about: zod_1.z.string().trim().max(300).default(""),
    cover: zod_1.z.url().optional(),
});
const withCounts = (viewerId) => ({
    _count: { select: { members: true } },
    members: { where: { userId: viewerId ?? "" }, select: { userId: true }, take: 1 },
});
const toDto = (c) => ({ id: c.id, name: c.name, about: c.about, cover: c.cover, membersCount: c._count.members, joined: c.members.length > 0 });
router.get("/", auth_1.optionalAuth, async (req, res) => {
    const rows = await prisma_1.prisma.community.findMany({
        orderBy: { members: { _count: "desc" } },
        include: withCounts(req.user?.id),
    });
    (0, response_1.ok)(res, rows.map(toDto));
});
router.post("/", auth_1.requireAuth, (0, validate_1.validate)({ body: createSchema }), async (req, res) => {
    const community = await prisma_1.prisma.community.create({
        data: { ...req.body, members: { create: { userId: (0, response_1.userId)(req) } } }, // creator joins automatically
        include: withCounts((0, response_1.userId)(req)),
    });
    (0, response_1.created)(res, toDto(community));
});
const exists = async (id) => {
    if (!(await prisma_1.prisma.community.findUnique({ where: { id }, select: { id: true } })))
        throw ApiError_1.ApiError.notFound("Community not found");
};
router.post("/:id/join", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    const id = req.params.id;
    await exists(id);
    await prisma_1.prisma.communityMember.createMany({ data: [{ communityId: id, userId: (0, response_1.userId)(req) }], skipDuplicates: true });
    (0, response_1.message)(res, "Joined community");
});
router.delete("/:id/join", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await prisma_1.prisma.communityMember.deleteMany({ where: { communityId: req.params.id, userId: (0, response_1.userId)(req) } });
    (0, response_1.message)(res, "Left community");
});
exports.default = router;
//# sourceMappingURL=community.routes.js.map