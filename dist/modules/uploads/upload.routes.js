"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../config/prisma");
const cloudinary_1 = require("../../lib/cloudinary");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const validate_1 = require("../../middleware/validate");
const ApiError_1 = require("../../utils/ApiError");
const response_1 = require("../../utils/response");
const router = (0, express_1.Router)();
// সব আপলোড রুটে লগইন লাগবে
router.use(auth_1.requireAuth);
/**
 * POST /api/uploads/image-signature
 * Browser Cloudinary-তে সরাসরি image আপলোড করার জন্য signature
 */
router.post('/image-signature', rateLimit_1.uploadLimiter, (req, res) => {
    (0, response_1.ok)(res, (0, cloudinary_1.createImageUploadSignature)((0, response_1.userId)(req)));
});
/**
 * POST /api/uploads/video-signature
 * Browser Cloudinary-তে সরাসরি video আপলোড করার জন্য signature
 */
router.post('/video-signature', rateLimit_1.uploadLimiter, (req, res) => {
    (0, response_1.ok)(res, (0, cloudinary_1.createVideoUploadSignature)((0, response_1.userId)(req)));
});
/**
 * POST /api/uploads/imgbb
 * Frontend base64 পাঠায় → backend ImgBB-তে আপলোড করে → URL ফেরত দেয়
 */
router.post('/imgbb', rateLimit_1.uploadLimiter, async (req, res) => {
    try {
        const { imageBase64 } = req.body ?? {};
        if (!imageBase64 || typeof imageBase64 !== 'string') {
            return res
                .status(400)
                .json({ success: false, message: 'imageBase64 required' });
        }
        const apiKey = process.env.IMGBB_API_KEY;
        if (!apiKey) {
            return res
                .status(500)
                .json({ success: false, message: 'IMGBB_API_KEY not configured' });
        }
        const form = new URLSearchParams();
        form.append('key', apiKey);
        form.append('image', imageBase64);
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: form
        });
        // টাইপ বলে দিলাম → unknown এরর যাবে
        const data = (await response.json());
        if (!data.success || !data.data?.url) {
            return res.status(400).json({
                success: false,
                message: data.error?.message || 'ImgBB upload failed'
            });
        }
        (0, response_1.ok)(res, {
            url: data.data.url,
            displayUrl: data.data.display_url,
            deleteUrl: data.data.delete_url
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        res.status(500).json({ success: false, message });
    }
});
const discardSchema = zod_1.z.object({
    publicId: zod_1.z.string().min(1).max(200)
});
/**
 * DELETE /api/uploads/video  { publicId }
 * Composer থেকে video বাদ দিলে Cloudinary থেকে মুছে ফেলা
 */
router.delete('/video', (0, validate_1.validate)({ body: discardSchema }), async (req, res) => {
    const { publicId } = req.body;
    if (!(0, cloudinary_1.ownsVideo)((0, response_1.userId)(req), publicId)) {
        throw ApiError_1.ApiError.forbidden('This video does not belong to you', 'VIDEO_NOT_OWNED');
    }
    const used = await prisma_1.prisma.post.findUnique({
        where: { videoPublicId: publicId },
        select: { id: true }
    });
    if (used) {
        throw ApiError_1.ApiError.conflict('This video is attached to a post. Delete the post instead.');
    }
    await (0, cloudinary_1.deleteVideo)(publicId);
    (0, response_1.message)(res, 'Video discarded');
});
exports.default = router;
//# sourceMappingURL=upload.routes.js.map