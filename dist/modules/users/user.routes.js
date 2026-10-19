"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const post_service_1 = require("../posts/post.service");
const post_schema_1 = require("../posts/post.schema");
const user_schema_1 = require("./user.schema");
const user_service_1 = require("./user.service");
const router = (0, express_1.Router)();
// Fixed paths first
router.get("/search", (0, validate_1.validate)({ query: user_schema_1.searchUsersQuery }), auth_1.optionalAuth, async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.search(req.query.q, req.user?.id));
});
router.get("/suggestions", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.suggestions((0, response_1.userId)(req)));
});
router.get("/me/following", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, (await user_service_1.userService.myFollowing((0, response_1.userId)(req))).items);
});
router.get("/me/followers", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, (await user_service_1.userService.myFollowers((0, response_1.userId)(req))).items);
});
router.get("/me/requests", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.pendingRequests((0, response_1.userId)(req)));
});
router.get("/me/messageable", auth_1.requireAuth, async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.messageableFollowers((0, response_1.userId)(req)));
});
router.patch("/me", auth_1.requireAuth, (0, validate_1.validate)({ body: user_schema_1.updateProfileSchema }), async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.updateMe((0, response_1.userId)(req), req.body));
});
router.patch("/me/privacy", auth_1.requireAuth, (0, validate_1.validate)({ body: user_schema_1.updatePrivacySchema }), async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.updatePrivacy((0, response_1.userId)(req), req.body.privacy));
});
router.get("/:username", (0, validate_1.validate)({ params: response_1.usernameParam }), auth_1.optionalAuth, async (req, res) => {
    (0, response_1.ok)(res, await user_service_1.userService.getProfile(req.params.username, req.user?.id));
});
router.get("/:username/posts", (0, validate_1.validate)({ params: response_1.usernameParam, query: post_schema_1.feedQuery }), auth_1.optionalAuth, async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await post_service_1.postService.list({
        viewerId: req.user?.id,
        username: req.params.username.toLowerCase(),
        cursor,
        limit,
    });
    (0, response_1.ok)(res, items, { nextCursor });
});
router.get("/:username/followers", (0, validate_1.validate)({ params: response_1.usernameParam, query: response_1.paginationQuery }), auth_1.optionalAuth, async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await user_service_1.userService.followers(req.params.username, cursor, limit, req.user?.id);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.get("/:username/following", (0, validate_1.validate)({ params: response_1.usernameParam, query: response_1.paginationQuery }), auth_1.optionalAuth, async (req, res) => {
    const { cursor, limit } = req.query;
    const { items, nextCursor } = await user_service_1.userService.following(req.params.username, cursor, limit, req.user?.id);
    (0, response_1.ok)(res, items, { nextCursor });
});
router.post("/:username/follow", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    const result = await user_service_1.userService.follow((0, response_1.userId)(req), req.params.username);
    (0, response_1.ok)(res, result);
});
router.delete("/:username/follow", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    await user_service_1.userService.unfollow((0, response_1.userId)(req), req.params.username);
    (0, response_1.message)(res, "Unfollowed");
});
router.delete("/:username/request", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    await user_service_1.userService.cancelRequest((0, response_1.userId)(req), req.params.username);
    (0, response_1.message)(res, "Request cancelled");
});
router.post("/:username/accept", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    await user_service_1.userService.acceptRequest((0, response_1.userId)(req), req.params.username);
    (0, response_1.message)(res, "Request accepted");
});
router.post("/:username/reject", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    await user_service_1.userService.rejectRequest((0, response_1.userId)(req), req.params.username);
    (0, response_1.message)(res, "Request rejected");
});
router.delete("/:username/follower", auth_1.requireAuth, (0, validate_1.validate)({ params: response_1.usernameParam }), async (req, res) => {
    await user_service_1.userService.removeFollower((0, response_1.userId)(req), req.params.username);
    (0, response_1.message)(res, "Follower removed");
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map