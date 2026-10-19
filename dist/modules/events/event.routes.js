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
    title: zod_1.z.string().trim().min(3).max(100),
    description: zod_1.z.string().trim().max(1000).default(""),
    location: zod_1.z.string().trim().min(2).max(100),
    startsAt: zod_1.z.coerce.date().refine((d) => d.getTime() > Date.now(), "Event must be in the future"),
    cover: zod_1.z.url().optional(),
});
const withCounts = (viewerId) => ({
    _count: { select: { attendees: true } },
    attendees: { where: { userId: viewerId ?? "" }, select: { userId: true }, take: 1 },
});
const toDto = (e) => ({
    id: e.id, title: e.title, description: e.description, cover: e.cover, location: e.location, startsAt: e.startsAt,
    goingCount: e._count.attendees, going: e.attendees.length > 0,
});
router.get("/", auth_1.optionalAuth, async (req, res) => {
    const rows = await prisma_1.prisma.event.findMany({
        where: { startsAt: { gte: new Date() } }, // upcoming only
        orderBy: { startsAt: "asc" },
        include: withCounts(req.user?.id),
    });
    (0, response_1.ok)(res, rows.map(toDto));
});
router.post("/", auth_1.requireAuth, (0, validate_1.validate)({ body: createSchema }), async (req, res) => {
    const event = await prisma_1.prisma.event.create({ data: req.body, include: withCounts((0, response_1.userId)(req)) });
    (0, response_1.created)(res, toDto(event));
});
router.post("/:id/going", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    const id = req.params.id;
    if (!(await prisma_1.prisma.event.findUnique({ where: { id }, select: { id: true } })))
        throw ApiError_1.ApiError.notFound("Event not found");
    await prisma_1.prisma.eventAttendee.createMany({ data: [{ eventId: id, userId: (0, response_1.userId)(req) }], skipDuplicates: true });
    (0, response_1.message)(res, "You are going");
});
router.delete("/:id/going", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await prisma_1.prisma.eventAttendee.deleteMany({ where: { eventId: req.params.id, userId: (0, response_1.userId)(req) } });
    (0, response_1.message)(res, "No longer going");
});
exports.default = router;
//# sourceMappingURL=event.routes.js.map