"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refresh = exports.login = exports.resendCode = exports.verifyEmail = exports.register = void 0;
const env_1 = require("../../config/env");
const response_1 = require("../../utils/response");
const auth_service_1 = require("./auth.service");
const COOKIE_NAME = "refreshToken";
// httpOnly: JavaScript in the browser can never read the refresh token.
// Production: SameSite=None + Secure so a frontend on another domain can use it.
const cookieOptions = {
    httpOnly: true,
    secure: env_1.env.isProd,
    sameSite: env_1.env.isProd ? "none" : "lax",
    path: "/api/auth", // sent only to auth routes
};
const setRefreshCookie = (res, token) => res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: env_1.env.REFRESH_TOKEN_DAYS * 86_400_000 });
/** Native apps cannot use httpOnly cookies, so they send `X-Client: mobile` and get the refresh token in the JSON body. */
const isMobile = (req) => req.get("x-client")?.toLowerCase() === "mobile";
const sendSession = (req, res, session) => {
    setRefreshCookie(res, session.refreshToken);
    return (0, response_1.ok)(res, {
        accessToken: session.accessToken,
        user: session.user,
        ...(isMobile(req) ? { refreshToken: session.refreshToken } : {}),
    });
};
const refreshTokenFrom = (req) => req.cookies?.[COOKIE_NAME] || (isMobile(req) ? req.body?.refreshToken : undefined);
const agent = (req) => req.get("user-agent");
const register = async (req, res) => {
    await auth_service_1.authService.register(req.body);
    (0, response_1.message)(res, "Account created. We sent a 6-digit code to your email.", 201);
};
exports.register = register;
const verifyEmail = async (req, res) => {
    sendSession(req, res, await auth_service_1.authService.verifyEmail(req.body.email, req.body.code, agent(req)));
};
exports.verifyEmail = verifyEmail;
const resendCode = async (req, res) => {
    await auth_service_1.authService.resendVerification(req.body.email);
    (0, response_1.message)(res, "If the account exists and is not verified, a new code was sent.");
};
exports.resendCode = resendCode;
const login = async (req, res) => {
    sendSession(req, res, await auth_service_1.authService.login(req.body.email, req.body.password, agent(req)));
};
exports.login = login;
const refresh = async (req, res) => {
    try {
        sendSession(req, res, await auth_service_1.authService.refresh(refreshTokenFrom(req), agent(req)));
    }
    catch (err) {
        res.clearCookie(COOKIE_NAME, cookieOptions);
        throw err;
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    await auth_service_1.authService.logout(refreshTokenFrom(req));
    res.clearCookie(COOKIE_NAME, cookieOptions);
    (0, response_1.message)(res, "Logged out");
};
exports.logout = logout;
const forgotPassword = async (req, res) => {
    await auth_service_1.authService.forgotPassword(req.body.email);
    (0, response_1.message)(res, "If an account exists for this email, a reset code was sent.");
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    await auth_service_1.authService.resetPassword(req.body.email, req.body.code, req.body.newPassword);
    (0, response_1.message)(res, "Password updated. Please log in with your new password.");
};
exports.resetPassword = resetPassword;
const changePassword = async (req, res) => {
    await auth_service_1.authService.changePassword((0, response_1.userId)(req), req.body.currentPassword, req.body.newPassword);
    (0, response_1.message)(res, "Password changed");
};
exports.changePassword = changePassword;
const me = async (req, res) => {
    (0, response_1.ok)(res, await auth_service_1.authService.me((0, response_1.userId)(req)));
};
exports.me = me;
//# sourceMappingURL=auth.controller.js.map