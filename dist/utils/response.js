"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usernameParam = exports.idParam = exports.toPage = exports.cursorArgs = exports.paginationQuery = exports.userId = exports.message = exports.created = exports.ok = void 0;
const zod_1 = require("zod");
const ApiError_1 = require("./ApiError");
/** Success envelope: { success: true, data, ...meta } */
const ok = (res, data, meta = {}, status = 200) => res.status(status).json({ success: true, data, ...meta });
exports.ok = ok;
const created = (res, data) => (0, exports.ok)(res, data, {}, 201);
exports.created = created;
const message = (res, text, status = 200) => res.status(status).json({ success: true, message: text });
exports.message = message;
/** Id of the logged-in user (set by requireAuth). Throws 401 if missing. */
const userId = (req) => {
    if (!req.user)
        throw ApiError_1.ApiError.unauthorized();
    return req.user.id;
};
exports.userId = userId;
/** Shared ?cursor=&limit= query used by every paginated list. */
exports.paginationQuery = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10)
});
/** Prisma args for cursor pagination (fetches one extra row to know if there is a next page). */
const cursorArgs = (cursor, limit) => ({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
});
exports.cursorArgs = cursorArgs;
/** Trims the extra row and returns { items, nextCursor }. */
const toPage = (rows, limit) => {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
        items,
        nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null
    };
};
exports.toPage = toPage;
exports.idParam = zod_1.z.object({ id: zod_1.z.string().min(1) });
exports.usernameParam = zod_1.z.object({ username: zod_1.z.string().min(1) });
//# sourceMappingURL=response.js.map