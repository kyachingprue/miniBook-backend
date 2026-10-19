"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const response_1 = require("../../utils/response");
const story_service_1 = require("./story.service");
const router = (0, express_1.Router)();
router.get("/", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, await story_service_1.storyService.listFeed((0, response_1.userId)(req)));
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { mediaUrl, mediaType, caption } = req.body ?? {};
    if (!mediaUrl || !mediaType) {
        return res.status(400).json({ success: false, message: "mediaUrl and mediaType required" });
    }
    (0, response_1.ok)(res, await story_service_1.storyService.create((0, response_1.userId)(req), { mediaUrl, mediaType, caption }), undefined, 201);
});
router.post("/:id/view", auth_1.requireAuth, async (req, res) => {
    await story_service_1.storyService.markViewed(req.params.id, (0, response_1.userId)(req));
    (0, response_1.message)(res, "Viewed");
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    await story_service_1.storyService.delete(req.params.id, (0, response_1.userId)(req));
    (0, response_1.message)(res, "Deleted");
});
exports.default = router;
//# sourceMappingURL=story.routes.js.map