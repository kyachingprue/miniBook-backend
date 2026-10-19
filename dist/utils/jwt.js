"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.signRefreshToken = exports.verifyAccessToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccessToken = (userId) => jsonwebtoken_1.default.sign({ sub: userId }, env_1.env.JWT_ACCESS_SECRET, {
    expiresIn: env_1.env.ACCESS_TOKEN_MINUTES * 60 // seconds
});
exports.signAccessToken = signAccessToken;
const verifyAccessToken = (token) => jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
exports.verifyAccessToken = verifyAccessToken;
/** `sid` = id of the RefreshToken row, used for rotation and revocation. */
const signRefreshToken = (userId, sid) => jsonwebtoken_1.default.sign({ sub: userId, sid }, env_1.env.JWT_REFRESH_SECRET, {
    expiresIn: env_1.env.REFRESH_TOKEN_DAYS * 24 * 60 * 60
});
exports.signRefreshToken = signRefreshToken;
const verifyRefreshToken = (token) => jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map