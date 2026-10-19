"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../config/prisma");
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const community_routes_1 = __importDefault(require("../modules/communities/community.routes"));
const event_routes_1 = __importDefault(require("../modules/events/event.routes"));
const message_routes_1 = __importDefault(require("../modules/messages/message.routes"));
const notification_routes_1 = __importDefault(require("../modules/notifications/notification.routes"));
const post_routes_1 = __importStar(require("../modules/posts/post.routes"));
const upload_routes_1 = __importDefault(require("../modules/uploads/upload.routes"));
const user_routes_1 = __importDefault(require("../modules/users/user.routes"));
const admin_routes_1 = __importDefault(require("../modules/admin/admin.routes"));
const story_routes_1 = __importDefault(require("../modules/stories/story.routes"));
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    await prisma_1.prisma.$queryRaw `SELECT 1`;
    res.json({
        success: true,
        status: 'ok',
        uptime: Math.round(process.uptime())
    });
});
router.use('/auth', auth_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/users', user_routes_1.default);
router.use('/posts', post_routes_1.default);
router.use('/comments', post_routes_1.commentRouter);
router.use('/notifications', notification_routes_1.default);
router.use('/messages', message_routes_1.default);
router.use('/communities', community_routes_1.default);
router.use('/events', event_routes_1.default);
router.use('/uploads', upload_routes_1.default);
router.use('/stories', story_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map