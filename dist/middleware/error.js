"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const notFound = (req, _res, next) => {
    next(ApiError_1.ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
exports.notFound = notFound;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError_1.ApiError) {
        return void res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    if (err instanceof zod_1.ZodError) {
        return void res.status(422).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            errors: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            const target = err.meta?.target?.join(", ") ?? "value";
            return void res.status(409).json({ success: false, code: "CONFLICT", message: `This ${target} is already in use` });
        }
        if (err.code === "P2025") {
            return void res.status(404).json({ success: false, code: "NOT_FOUND", message: "Resource not found" });
        }
        if (err.code === "P2003") {
            return void res.status(400).json({ success: false, code: "BAD_REFERENCE", message: "Related resource does not exist" });
        }
    }
    // Malformed JSON body
    if (err instanceof SyntaxError && "body" in err) {
        return void res.status(400).json({ success: false, code: "INVALID_JSON", message: "Request body is not valid JSON" });
    }
    console.error("💥 Unhandled error:", err);
    res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: env_1.env.isProd ? "Something went wrong" : String(err?.message ?? err),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.js.map