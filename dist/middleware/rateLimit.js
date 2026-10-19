"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
const base = {
    standardHeaders: "draft-8",
    legacyHeaders: false,
};
/** Applied to the whole API */
exports.apiLimiter = (0, express_rate_limit_1.rateLimit)({
    ...base,
    windowMs: 15 * 60 * 1000,
    limit: 600,
    message: { success: false, code: "TOO_MANY_REQUESTS", message: "Too many requests, slow down." },
});
/** Stricter limit for login / register / code endpoints (brute-force protection) */
exports.authLimiter = (0, express_rate_limit_1.rateLimit)({
    ...base,
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: { success: false, code: "TOO_MANY_REQUESTS", message: "Too many attempts, try again in a few minutes." },
});
/** Video signature requests: each one allows a large upload, so keep it tight */
exports.uploadLimiter = (0, express_rate_limit_1.rateLimit)({
    ...base,
    windowMs: 60 * 60 * 1000,
    limit: 30,
    message: { success: false, code: "TOO_MANY_REQUESTS", message: "Too many upload requests, try again later." },
});
//# sourceMappingURL=rateLimit.js.map