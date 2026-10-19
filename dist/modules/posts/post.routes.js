"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentRouter = void 0;
const zod_1 = require("zod");
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const post_schema_1 = require("./post.schema");
const post_service_1 = require("./post.service");
const router = (0, express_1.Router)();
const pid = (req) => req.params.id;
// ── feed ──
router.get("/", (0, validate_1.validate)({ query: post_schema_1.feedQuery }), auth_1.optionalAuth, async (req, res) => {
    const q = req.query;
    const { items, nextCursor } = await post_service_1.postService.list({ viewerId: req.user?.id, ...q });
    (0, response_1.ok)(res, items, { nextCursor });
});
router.get("/trending", async (_req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.trending());
});
router.get("/bookmarks", auth_1.requireAuth, (0, validate_1.validate)({ query: response_1.paginationQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await post_service_1.postService.bookmarks((0, response_1.userId)(req), cursor, limit);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.post("/", auth_1.requireAuth, (0, validate_1.validate)({ body: post_schema_1.createPostSchema }), async (req, res) => {
    (0, response_1.created)(res, await post_service_1.postService.create((0, response_1.userId)(req), req.body));
});
// ── single post ──
router.get("/:id", (0, validate_1.validate)({ params: response_1.idParam }), auth_1.optionalAuth, async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.get(pid(req), req.user?.id));
});
router.patch("/:id", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam, body: zod_1.z.object({ text: zod_1.z.string().trim().max(500) }) }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.update(pid(req), (0, response_1.userId)(req), req.body.text));
});
router.delete("/:id", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await post_service_1.postService.remove(pid(req), (0, response_1.userId)(req));
    (0, response_1.message)(res, "Post deleted");
});
// ── reactions ──
router.post("/:id/like", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.like(pid(req), (0, response_1.userId)(req)));
});
router.delete("/:id/like", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.unlike(pid(req), (0, response_1.userId)(req)));
});
router.post("/:id/bookmark", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.bookmark(pid(req), (0, response_1.userId)(req)));
});
router.delete("/:id/bookmark", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.unbookmark(pid(req), (0, response_1.userId)(req)));
});
router.post("/:id/share", (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    (0, response_1.ok)(res, await post_service_1.postService.share(pid(req)));
});
// ── comments ──
router.get("/:id/comments", (0, validate_1.validate)({ params: response_1.idParam, query: response_1.paginationQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await post_service_1.postService.comments(pid(req), cursor, limit);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.post("/:id/comments", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam, body: post_schema_1.createCommentSchema }), async (req, res) => {
    (0, response_1.created)(res, await post_service_1.postService.addComment(pid(req), (0, response_1.userId)(req), req.body.text, req.body.parentId));
});
exports.commentRouter = (0, express_1.Router)();
exports.commentRouter.delete("/:id", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.idParam }), async (req, res) => {
    await post_service_1.postService.removeComment(pid(req), (0, response_1.userId)(req));
    (0, response_1.message)(res, "Comment deleted");
});
exports.default = router;
//# sourceMappingURL=post.routes.js.map