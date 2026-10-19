"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.corsOrigin = void 0;
const env_1 = require("./env");
/**
 * One CORS rule shared by the REST API and Socket.IO.
 *
 * Allowed callers:
 *  - requests with no Origin header (native Android/iOS apps, curl, server-to-server)
 *  - every origin listed in CLIENT_URL (comma separated)
 *  - in development: any localhost / 127.0.0.1 / LAN address on any port
 *    (Vite :5173, Expo web :8081 / :19006, Android emulator 10.0.2.2, phones on your Wi-Fi)
 *  - capacitor / ionic / expo schemes used by hybrid wrappers
 */
const devOrigin = /^(https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?|capacitor:\/\/localhost|ionic:\/\/localhost|exp:\/\/.*)$/;
const corsOrigin = (origin, callback) => {
    if (!origin)
        return callback(null, true);
    if (env_1.env.clientOrigins.includes('*'))
        return callback(null, true);
    if (env_1.env.clientOrigins.includes(origin))
        return callback(null, true);
    if (!env_1.env.isProd && devOrigin.test(origin))
        return callback(null, true);
    return callback(null, false);
};
exports.corsOrigin = corsOrigin;
exports.corsOptions = {
    origin: exports.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client', 'X-Requested-With'],
    exposedHeaders: ['RateLimit', 'RateLimit-Policy'],
    maxAge: 600
};
//# sourceMappingURL=cors.js.map