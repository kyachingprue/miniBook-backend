"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommentSchema = exports.feedQuery = exports.createPostSchema = void 0;
const zod_1 = require("zod");
const response_1 = require("../../utils/response");
exports.createPostSchema = zod_1.z
    .object({
    text: zod_1.z
        .string()
        .trim()
        .max(500, 'Post can be at most 500 characters')
        .default(''),
    image: zod_1.z.url('Image must be a valid URL').optional(),
    // public_id returned by POST /uploads/video-signature (after the browser uploaded the file to Cloudinary)
    videoPublicId: zod_1.z.string().trim().min(1).max(200).optional(),
    visibility: zod_1.z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
})
    .refine(v => v.text.length > 0 || v.image || v.videoPublicId, 'A post needs text, an image or a video')
    .refine(v => !(v.image && v.videoPublicId), 'Choose either an image or a video, not both');
/** GET /posts — `scope=following` only returns people you follow; `q` searches text, name and username. */
exports.feedQuery = response_1.paginationQuery.extend({
    scope: zod_1.z.enum(['all', 'following']).default('all'),
    q: zod_1.z.string().trim().min(1).max(50).optional()
});
exports.createCommentSchema = zod_1.z.object({
    text: zod_1.z.string().trim().min(1, 'Comment cannot be empty').max(300),
    parentId: zod_1.z.string().optional()
});
//# sourceMappingURL=post.schema.js.map