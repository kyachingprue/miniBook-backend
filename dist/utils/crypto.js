"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = exports.safeEqual = exports.hashCode = exports.generateCode = void 0;
const node_crypto_1 = require("node:crypto");
const env_1 = require("../config/env");
/** Random 6-digit code, e.g. "042917" */
const generateCode = () => (0, node_crypto_1.randomInt)(0, 1_000_000).toString().padStart(6, "0");
exports.generateCode = generateCode;
/** Codes are stored hashed (HMAC) so a database leak does not reveal them. */
const hashCode = (code) => (0, node_crypto_1.createHmac)("sha256", env_1.env.JWT_ACCESS_SECRET).update(code).digest("hex");
exports.hashCode = hashCode;
const safeEqual = (a, b) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && (0, node_crypto_1.timingSafeEqual)(x, y);
};
exports.safeEqual = safeEqual;
/** Refresh tokens are stored as SHA-256 hashes. */
const hashToken = (token) => (0, node_crypto_1.createHash)("sha256").update(token).digest("hex");
exports.hashToken = hashToken;
//# sourceMappingURL=crypto.js.map