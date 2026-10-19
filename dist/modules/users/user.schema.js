"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePrivacySchema = exports.searchUsersQuery = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
const optionalText = (max) => zod_1.z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
const optionalUrl = zod_1.z.union([zod_1.z.literal(""), zod_1.z.url("Must be a valid URL")]).transform((v) => (v === "" ? null : v)).nullable().optional();
exports.updateProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2).max(50).optional(),
    username: zod_1.z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Username: 3-20 letters, numbers or underscores").optional(),
    bio: optionalText(160),
    location: optionalText(60),
    website: optionalText(100),
    avatar: optionalUrl,
    cover: optionalUrl,
    passion: optionalText(120),
    relationshipStatus: zod_1.z.enum(["Single", "Married", "In a relationship", "Prefer not to say"]).nullable().optional(),
})
    .refine((v) => Object.keys(v).length > 0, "Send at least one field to update");
exports.searchUsersQuery = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).max(50),
});
exports.updatePrivacySchema = zod_1.z.object({
    privacy: zod_1.z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
});
//# sourceMappingURL=user.schema.js.map