"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.optionalAuth = exports.requireAuth = void 0;
const ApiError_1 = require("../utils/ApiError");
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../config/prisma");
const bearerToken = (req) => {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
};
/** Route needs a logged-in user. Expects `Authorization: Bearer <accessToken>`. */
const requireAuth = async (req, _res, next) => {
    const token = bearerToken(req);
    if (!token)
        throw ApiError_1.ApiError.unauthorized();
    try {
        req.user = { id: (0, jwt_1.verifyAccessToken)(token).sub };
    }
    catch {
        throw ApiError_1.ApiError.unauthorized('Access token is invalid or expired', 'TOKEN_EXPIRED');
    }
    const authenticatedId = req.user.id;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: authenticatedId },
        select: { isActive: true }
    });
    if (!user || !user.isActive)
        throw ApiError_1.ApiError.forbidden('This account is inactive');
    // Best-effort last-seen update for online indicators (fire-and-forget)
    void prisma_1.prisma.user
        .update({
        where: { id: authenticatedId },
        data: { lastSeenAt: new Date() }
    })
        .catch(() => { });
    next();
};
exports.requireAuth = requireAuth;
/** Public route that returns extra info (liked, following…) when a valid token is sent. */
const optionalAuth = (req, _res, next) => {
    const token = bearerToken(req);
    if (token) {
        try {
            req.user = { id: (0, jwt_1.verifyAccessToken)(token).sub };
        }
        catch {
            /* treat as anonymous */
        }
    }
    next();
};
exports.optionalAuth = optionalAuth;
/** Server-side admin authorization; never trust the role sent by the browser. */
const requireAdmin = async (req, _res, next) => {
    const token = bearerToken(req);
    if (!token)
        throw ApiError_1.ApiError.unauthorized();
    let id;
    try {
        id = (0, jwt_1.verifyAccessToken)(token).sub;
    }
    catch {
        throw ApiError_1.ApiError.unauthorized('Access token is invalid or expired', 'TOKEN_EXPIRED');
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true }
    });
    if (!user || !user.isActive)
        throw ApiError_1.ApiError.forbidden('This account is inactive');
    if (user.role.toLowerCase() !== 'admin' &&
        user.role.toLowerCase() !== 'administrator')
        throw ApiError_1.ApiError.forbidden('Administrator access required');
    req.user = { id };
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map