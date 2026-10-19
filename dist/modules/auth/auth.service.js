"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.privateUser = void 0;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const ApiError_1 = require("../../utils/ApiError");
const crypto_1 = require("../../utils/crypto");
const jwt_1 = require("../../utils/jwt");
const mailer_1 = require("../../lib/mailer");
const MAX_CODE_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;
// Used so login takes the same time whether or not the email exists
const DUMMY_HASH = bcryptjs_1.default.hashSync("not-a-real-password", BCRYPT_ROUNDS);
/** Fields safe to send to the logged-in user (never includes passwordHash). */
const privateUser = (u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    emailVerified: u.emailVerified,
    role: u.role || "USER",
    isActive: u.isActive ?? true,
    avatar: u.avatar,
    cover: u.cover,
    bio: u.bio,
    location: u.location,
    website: u.website,
    passion: u.passion ?? null,
    relationshipStatus: u.relationshipStatus ?? null,
    privacy: u.privacy ?? "PUBLIC",
    lastSeenAt: u.lastSeenAt ?? null,
    createdAt: u.createdAt,
});
exports.privateUser = privateUser;
// ───────────────────────── verification codes ─────────────────────────
async function issueCode(user, type) {
    // Cooldown: stop people from spamming the mail server
    const last = await prisma_1.prisma.verificationCode.findFirst({
        where: { userId: user.id, type },
        orderBy: { createdAt: "desc" },
    });
    if (last && Date.now() - last.createdAt.getTime() < env_1.env.CODE_RESEND_SECONDS * 1000) {
        throw ApiError_1.ApiError.tooMany(`Please wait ${env_1.env.CODE_RESEND_SECONDS} seconds before requesting another code`);
    }
    const code = (0, crypto_1.generateCode)();
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.verificationCode.deleteMany({ where: { userId: user.id, type } }),
        prisma_1.prisma.verificationCode.create({
            data: {
                userId: user.id,
                type,
                codeHash: (0, crypto_1.hashCode)(code),
                expiresAt: new Date(Date.now() + env_1.env.CODE_EXPIRES_MINUTES * 60_000),
            },
        }),
    ]);
    try {
        const mail = type === client_1.CodeType.EMAIL_VERIFICATION ? mailer_1.sendVerificationEmail : mailer_1.sendPasswordResetEmail;
        await mail(user.email, user.name, code);
    }
    catch (err) {
        console.error("Mail error:", err);
        throw new ApiError_1.ApiError(502, "We could not send the email. Please try again later.", "MAIL_FAILED");
    }
}
async function consumeCode(userId, type, code) {
    const record = await prisma_1.prisma.verificationCode.findFirst({
        where: { userId, type },
        orderBy: { createdAt: "desc" },
    });
    const invalid = ApiError_1.ApiError.badRequest("Code is invalid or expired", "INVALID_CODE");
    if (!record || record.expiresAt < new Date())
        throw invalid;
    if (record.attempts >= MAX_CODE_ATTEMPTS)
        throw ApiError_1.ApiError.tooMany("Too many wrong attempts. Request a new code.");
    if (!(0, crypto_1.safeEqual)(record.codeHash, (0, crypto_1.hashCode)(code))) {
        await prisma_1.prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
        throw invalid;
    }
    await prisma_1.prisma.verificationCode.delete({ where: { id: record.id } });
}
// ───────────────────────── sessions (access + refresh tokens) ─────────────────────────
async function createSession(user, userAgent) {
    const sid = (0, node_crypto_1.randomUUID)();
    const refreshToken = (0, jwt_1.signRefreshToken)(user.id, sid);
    await prisma_1.prisma.refreshToken.create({
        data: {
            id: sid,
            userId: user.id,
            tokenHash: (0, crypto_1.hashToken)(refreshToken),
            userAgent: userAgent?.slice(0, 255),
            expiresAt: new Date(Date.now() + env_1.env.REFRESH_TOKEN_DAYS * 86_400_000),
        },
    });
    return { accessToken: (0, jwt_1.signAccessToken)(user.id), refreshToken, user: (0, exports.privateUser)(user) };
}
// ───────────────────────── public API ─────────────────────────
exports.authService = {
    async register(input) {
        const [byEmail, byUsername] = await Promise.all([
            prisma_1.prisma.user.findUnique({ where: { email: input.email } }),
            prisma_1.prisma.user.findUnique({ where: { username: input.username } }),
        ]);
        if (byUsername && byUsername.id !== byEmail?.id)
            throw ApiError_1.ApiError.conflict("Username is already taken");
        if (byEmail?.emailVerified)
            throw ApiError_1.ApiError.conflict("An account with this email already exists");
        const passwordHash = await bcryptjs_1.default.hash(input.password, BCRYPT_ROUNDS);
        const data = { name: input.name, username: input.username, passwordHash };
        // An unverified account with the same email is simply updated (user retrying sign-up)
        const user = byEmail
            ? await prisma_1.prisma.user.update({ where: { id: byEmail.id }, data })
            : await prisma_1.prisma.user.create({ data: { ...data, email: input.email } });
        await issueCode(user, client_1.CodeType.EMAIL_VERIFICATION);
    },
    async verifyEmail(email, code, userAgent) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw ApiError_1.ApiError.badRequest("Code is invalid or expired", "INVALID_CODE");
        if (user.emailVerified)
            throw ApiError_1.ApiError.badRequest("Email is already verified", "ALREADY_VERIFIED");
        await consumeCode(user.id, client_1.CodeType.EMAIL_VERIFICATION, code);
        const verified = await prisma_1.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
        return createSession(verified, userAgent); // log the user in right after verifying
    },
    async resendVerification(email) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        // Same response whether or not the account exists (no user enumeration)
        if (user && !user.emailVerified)
            await issueCode(user, client_1.CodeType.EMAIL_VERIFICATION);
    },
    async login(email, password, userAgent) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        const valid = await bcryptjs_1.default.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid)
            throw ApiError_1.ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
        if (!user.emailVerified) {
            await issueCode(user, client_1.CodeType.EMAIL_VERIFICATION).catch(() => undefined); // cooldown may apply
            throw ApiError_1.ApiError.forbidden("Please verify your email. We sent you a new code.", "EMAIL_NOT_VERIFIED");
        }
        return createSession(user, userAgent);
    },
    /** Rotates the refresh token. Re-using an old (revoked) token revokes ALL sessions of that user. */
    async refresh(token, userAgent) {
        if (!token)
            throw ApiError_1.ApiError.unauthorized("Refresh token missing", "NO_REFRESH_TOKEN");
        let payload;
        try {
            payload = (0, jwt_1.verifyRefreshToken)(token);
        }
        catch {
            throw ApiError_1.ApiError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
        }
        const record = await prisma_1.prisma.refreshToken.findUnique({ where: { id: payload.sid }, include: { user: true } });
        if (!record || !(0, crypto_1.safeEqual)(record.tokenHash, (0, crypto_1.hashToken)(token)) || record.expiresAt < new Date()) {
            throw ApiError_1.ApiError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
        }
        if (record.revokedAt) {
            await prisma_1.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
            throw ApiError_1.ApiError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
        }
        await prisma_1.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
        return createSession(record.user, userAgent);
    },
    async logout(token) {
        if (!token)
            return;
        try {
            const { sid } = (0, jwt_1.verifyRefreshToken)(token);
            await prisma_1.prisma.refreshToken.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        catch {
            /* already invalid — nothing to revoke */
        }
    },
    async forgotPassword(email) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (user?.emailVerified)
            await issueCode(user, client_1.CodeType.PASSWORD_RESET);
    },
    async resetPassword(email, code, newPassword) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw ApiError_1.ApiError.badRequest("Code is invalid or expired", "INVALID_CODE");
        await consumeCode(user.id, client_1.CodeType.PASSWORD_RESET, code);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS) } }),
            // Log the user out everywhere
            prisma_1.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
    },
    async changePassword(userId, currentPassword, newPassword) {
        const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!(await bcryptjs_1.default.compare(currentPassword, user.passwordHash))) {
            throw ApiError_1.ApiError.badRequest("Current password is incorrect", "WRONG_PASSWORD");
        }
        await prisma_1.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS) } });
    },
    async me(userId) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw ApiError_1.ApiError.unauthorized("Account no longer exists");
        return (0, exports.privateUser)(user);
    },
};
//# sourceMappingURL=auth.service.js.map