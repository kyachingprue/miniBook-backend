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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const validate_1 = require("../../middleware/validate");
const c = __importStar(require("./auth.controller"));
const auth_schema_1 = require("./auth.schema");
const router = (0, express_1.Router)();
router.post("/register", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.registerSchema }), c.register);
router.post("/verify-email", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.verifyEmailSchema }), c.verifyEmail);
router.post("/resend-code", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.emailOnlySchema }), c.resendCode);
router.post("/login", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.loginSchema }), c.login);
router.post("/refresh", c.refresh);
router.post("/logout", c.logout);
router.post("/forgot-password", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.emailOnlySchema }), c.forgotPassword);
router.post("/reset-password", rateLimit_1.authLimiter, (0, validate_1.validate)({ body: auth_schema_1.resetPasswordSchema }), c.resetPassword);
router.post("/change-password", auth_1.requireAuth, (0, validate_1.validate)({ body: auth_schema_1.changePasswordSchema }), c.changePassword);
router.get("/me", auth_1.requireAuth, c.me);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map