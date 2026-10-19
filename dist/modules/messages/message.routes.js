"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const message_service_1 = require("./message.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const startSchema = zod_1.z.object({ username: zod_1.z.string().trim().min(1) });
const sendSchema = zod_1.z.object({ text: zod_1.z.string().trim().min(1, "Message cannot be empty").max(1000) });
router.get("/conversations", async (req, res) => {
    (0, response_1.ok)(res, await message_service_1.messageService.conversations((0, response_1.userId)(req)));
});
router.get("/unread-count", async (req, res) => {
    (0, response_1.ok)(res, { count: await message_service_1.messageService.unreadCount((0, response_1.userId)(req)) });
});
router.post("/conversations", (0, validate_1.validate)({ body: startSchema }), async (req, res) => {
    (0, response_1.ok)(res, await message_service_1.messageService.start((0, response_1.userId)(req), req.body.username));
});
router.get("/conversations/:id/messages", (0, validate_1.validate)({ params: response_1.idParam, query: response_1.paginationQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await message_service_1.messageService.messages(req.params.id, (0, response_1.userId)(req), cursor, limit);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.post("/conversations/:id/messages", (0, validate_1.validate)({ params: response_1.idParam, body: sendSchema }), async (req, res) => {
    (0, response_1.created)(res, await message_service_1.messageService.send(req.params.id, (0, response_1.userId)(req), req.body.text));
});
router.patch("/conversations/:id/read", (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await message_service_1.messageService.markRead(req.params.id, (0, response_1.userId)(req));
    (0, response_1.message)(res, "Marked as read");
});
exports.default = router;
//# sourceMappingURL=message.routes.js.map