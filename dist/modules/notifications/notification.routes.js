"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const notification_service_1 = require("./notification.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", (0, validate_1.validate)({ query: response_1.paginationQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await notification_service_1.notificationService.list((0, response_1.userId)(req), cursor, limit);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.get("/unread-count", async (req, res) => {
    (0, response_1.ok)(res, { count: await notification_service_1.notificationService.unreadCount((0, response_1.userId)(req)) });
});
router.patch("/read-all", async (req, res) => {
    await notification_service_1.notificationService.markAllRead((0, response_1.userId)(req));
    (0, response_1.message)(res, "All notifications marked as read");
});
router.patch("/:id/read", (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await notification_service_1.notificationService.markRead((0, response_1.userId)(req), req.params.id);
    (0, response_1.message)(res, "Notification marked as read");
});
router.delete("/:id", (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await notification_service_1.notificationService.deleteOne((0, response_1.userId)(req), req.params.id);
    (0, response_1.message)(res, "Notification deleted");
});
router.delete("/", async (req, res) => {
    await notification_service_1.notificationService.clear((0, response_1.userId)(req));
    (0, response_1.message)(res, "Notifications cleared");
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map