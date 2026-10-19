"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoThumbnailUrl = exports.ownsVideo = exports.videoFolder = exports.ALLOWED_VIDEO_FORMATS = exports.imageFolder = void 0;
exports.createImageUploadSignature = createImageUploadSignature;
exports.createVideoUploadSignature = createVideoUploadSignature;
exports.verifyUploadedVideo = verifyUploadedVideo;
exports.deleteVideo = deleteVideo;
const node_crypto_1 = require("node:crypto");
const cloudinary_1 = require("cloudinary");
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
// 🔑 CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET come from your .env via src/config/env.ts
if (env_1.env.cloudinaryEnabled) {
    cloudinary_1.v2.config({
        cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
        api_key: env_1.env.CLOUDINARY_API_KEY,
        api_secret: env_1.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}
const imageFolder = (userId) => `minibook/images/${userId}`;
exports.imageFolder = imageFolder;
function createImageUploadSignature(userId) {
    assertEnabled();
    const publicId = `${(0, exports.imageFolder)(userId)}/${(0, node_crypto_1.randomUUID)()}`;
    const timestamp = Math.round(Date.now() / 1000);
    const signedParams = {
        folder: (0, exports.imageFolder)(userId),
        public_id: publicId,
        timestamp,
        allowed_formats: 'jpg,jpeg,png,webp,avif'
    };
    const signature = cloudinary_1.v2.utils.api_sign_request(signedParams, env_1.env.CLOUDINARY_API_SECRET);
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${env_1.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        fields: { ...signedParams, api_key: env_1.env.CLOUDINARY_API_KEY, signature },
        maxFileMB: 8
    };
}
exports.ALLOWED_VIDEO_FORMATS = ['mp4', 'mov', 'webm', 'm4v', '3gp'];
const maxVideoBytes = () => env_1.env.MAX_VIDEO_MB * 1024 * 1024;
/** Every user uploads into their own folder, so a public_id proves who it belongs to. */
const videoFolder = (userId) => `minibook/videos/${userId}`;
exports.videoFolder = videoFolder;
const ownsVideo = (userId, publicId) => publicId.startsWith(`${(0, exports.videoFolder)(userId)}/`) && !publicId.includes('..');
exports.ownsVideo = ownsVideo;
function assertEnabled() {
    if (!env_1.env.cloudinaryEnabled) {
        throw new ApiError_1.ApiError(503, 'Video uploads are not configured on this server', 'UPLOADS_DISABLED');
    }
}
/**
 * Step 1 of a video upload. The browser asks for a signature, then uploads the file
 * straight to Cloudinary (the video never passes through this server).
 * The server picks the public_id, so the client cannot upload into another user's folder
 * or use a format that is not allowed.
 */
function createVideoUploadSignature(userId) {
    assertEnabled();
    const publicId = `${(0, exports.videoFolder)(userId)}/${(0, node_crypto_1.randomUUID)()}`;
    const timestamp = Math.round(Date.now() / 1000);
    const allowedFormats = exports.ALLOWED_VIDEO_FORMATS.join(',');
    // Only these parameters are signed; the client must send exactly these values.
    const signedParams = {
        allowed_formats: allowedFormats,
        public_id: publicId,
        timestamp
    };
    const signature = cloudinary_1.v2.utils.api_sign_request(signedParams, env_1.env.CLOUDINARY_API_SECRET);
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${env_1.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
        // Append every entry of `fields` to the multipart form together with the `file`
        fields: { ...signedParams, api_key: env_1.env.CLOUDINARY_API_KEY, signature },
        publicId,
        maxFileMB: env_1.env.MAX_VIDEO_MB,
        maxDurationSeconds: env_1.env.MAX_VIDEO_SECONDS,
        expiresInSeconds: 3600 // Cloudinary rejects signatures older than 1 hour
    };
}
/**
 * Step 2: before a post is saved, ask Cloudinary (not the client) what was really uploaded.
 * Checks ownership, size and duration, and deletes the file if it breaks the rules.
 */
async function verifyUploadedVideo(userId, publicId) {
    assertEnabled();
    if (!(0, exports.ownsVideo)(userId, publicId))
        throw ApiError_1.ApiError.forbidden('This video does not belong to you', 'VIDEO_NOT_OWNED');
    let asset;
    try {
        asset = (await cloudinary_1.v2.api.resource(publicId, {
            resource_type: 'video'
        }));
    }
    catch {
        throw ApiError_1.ApiError.badRequest('Video was not found. Upload it first, then create the post.', 'VIDEO_NOT_FOUND');
    }
    if (asset.bytes > maxVideoBytes()) {
        await deleteVideo(publicId);
        throw new ApiError_1.ApiError(413, `Video is too large (max ${env_1.env.MAX_VIDEO_MB} MB)`, 'VIDEO_TOO_LARGE');
    }
    if (asset.duration !== undefined && asset.duration > env_1.env.MAX_VIDEO_SECONDS) {
        await deleteVideo(publicId);
        throw ApiError_1.ApiError.badRequest(`Video is too long (max ${env_1.env.MAX_VIDEO_SECONDS} seconds)`, 'VIDEO_TOO_LONG');
    }
    return { url: asset.secure_url, duration: asset.duration ?? null };
}
/** Poster image for a video (a frame picked automatically by Cloudinary). */
const videoThumbnailUrl = (publicId) => env_1.env.cloudinaryEnabled
    ? cloudinary_1.v2.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        secure: true,
        transformation: [{ width: 720, crop: 'limit', start_offset: 'auto' }]
    })
    : null;
exports.videoThumbnailUrl = videoThumbnailUrl;
/** Best-effort delete — a failure is logged but never breaks the request. */
async function deleteVideo(publicId) {
    if (!env_1.env.cloudinaryEnabled)
        return;
    try {
        await cloudinary_1.v2.uploader.destroy(publicId, {
            resource_type: 'video',
            invalidate: true
        });
    }
    catch (err) {
        console.error('Cloudinary delete failed:', publicId, err);
    }
}
//# sourceMappingURL=cloudinary.js.map