"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
/** Error with an HTTP status that the global error handler turns into a clean JSON response. */
class ApiError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "ApiError";
    }
    static badRequest(message = "Bad request", code) {
        return new ApiError(400, message, code);
    }
    static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
        return new ApiError(401, message, code);
    }
    static forbidden(message = "You are not allowed to do this", code = "FORBIDDEN") {
        return new ApiError(403, message, code);
    }
    static notFound(message = "Resource not found") {
        return new ApiError(404, message, "NOT_FOUND");
    }
    static conflict(message = "Already exists") {
        return new ApiError(409, message, "CONFLICT");
    }
    static tooMany(message = "Too many requests, please try again later") {
        return new ApiError(429, message, "TOO_MANY_REQUESTS");
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=ApiError.js.map