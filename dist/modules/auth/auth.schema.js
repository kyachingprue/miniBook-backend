"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.loginSchema = exports.emailOnlySchema = exports.verifyEmailSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const email = zod_1.z.string().trim().toLowerCase().pipe(zod_1.z.email("Enter a valid email"));
const code = zod_1.z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits");
const password = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Za-z]/, "Password needs at least one letter")
    .regex(/\d/, "Password needs at least one number");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Name is too short").max(50),
    username: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{3,20}$/, "Username: 3-20 letters, numbers or underscores"),
    email,
    password,
});
exports.verifyEmailSchema = zod_1.z.object({ email, code });
exports.emailOnlySchema = zod_1.z.object({ email });
exports.loginSchema = zod_1.z.object({ email, password: zod_1.z.string().min(1, "Password is required") });
exports.resetPasswordSchema = zod_1.z.object({ email, code, newPassword: password });
exports.changePasswordSchema = zod_1.z.object({ currentPassword: zod_1.z.string().min(1), newPassword: password });
//# sourceMappingURL=auth.schema.js.map