"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  🔑 THIS IS THE ONLY FILE THAT READS YOUR .env SECRETS       │
 * │  If your .env uses different variable names, rename them     │
 * │  here (the keys on the left) — nothing else needs changing.  │
 * └──────────────────────────────────────────────────────────────┘
 */
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(5000),
    // Frontend origin(s) for CORS, comma separated: http://localhost:5173,https://myapp.com
    CLIENT_URL: zod_1.z.string().default('http://localhost:5173'),
    // 🔑 Neon PostgreSQL — also read directly by prisma/schema.prisma
    DATABASE_URL: zod_1.z
        .string()
        .min(1, 'DATABASE_URL is required (Neon pooled connection string)'),
    // 🔑 JWT secrets — two different random strings, 32+ characters each
    JWT_ACCESS_SECRET: zod_1.z
        .string()
        .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: zod_1.z
        .string()
        .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_MINUTES: zod_1.z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_DAYS: zod_1.z.coerce.number().int().positive().default(30),
    // 🔑 Nodemailer SMTP — leave SMTP_HOST empty in development to print codes in the terminal
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().int().default(465),
    SMTP_SECURE: zod_1.z
        .enum(['true', 'false'])
        .default('true')
        .transform(v => v === 'true'),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    MAIL_FROM: zod_1.z.string().default('MiniBook <no-reply@minibook.local>'),
    // 🔑 Cloudinary — video uploads (leave empty to disable the upload endpoints)
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().optional(),
    CLOUDINARY_API_KEY: zod_1.z.string().optional(),
    CLOUDINARY_API_SECRET: zod_1.z.string().optional(),
    MAX_VIDEO_MB: zod_1.z.coerce.number().positive().default(100),
    MAX_VIDEO_SECONDS: zod_1.z.coerce.number().positive().default(180),
    // Email verification / password reset codes
    CODE_EXPIRES_MINUTES: zod_1.z.coerce.number().int().positive().default(10),
    CODE_RESEND_SECONDS: zod_1.z.coerce.number().int().nonnegative().default(60)
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
        console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\n👉 Check your .env file (see .env.example) or src/config/env.ts');
    process.exit(1);
}
if (parsed.data.NODE_ENV === 'production' && !parsed.data.SMTP_HOST) {
    console.error('❌ SMTP_HOST is required in production (email codes cannot be sent without it).');
    process.exit(1);
}
exports.env = {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    cloudinaryEnabled: Boolean(parsed.data.CLOUDINARY_CLOUD_NAME &&
        parsed.data.CLOUDINARY_API_KEY &&
        parsed.data.CLOUDINARY_API_SECRET),
    clientOrigins: parsed.data.CLIENT_URL.split(',')
        .map(s => s.trim())
        .filter(Boolean)
};
//# sourceMappingURL=env.js.map