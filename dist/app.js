"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cors_2 = require("./config/cors");
const env_1 = require("./config/env");
const error_1 = require("./middleware/error");
const rateLimit_1 = require("./middleware/rateLimit");
const routes_1 = __importDefault(require("./routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1); // correct client IPs behind Render / Railway / Vercel / Nginx
    app.disable('x-powered-by');
    // Images/videos are loaded cross-origin by the web + mobile apps
    app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    // 🔑 CLIENT_URL in .env lists the web frontend(s); native apps send no Origin and are always allowed
    app.use((0, cors_1.default)(cors_2.corsOptions));
    app.options('/{*path}', (0, cors_1.default)(cors_2.corsOptions));
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use((0, cookie_parser_1.default)());
    if (!env_1.env.isProd)
        app.use((0, morgan_1.default)('dev'));
    app.use('/api', rateLimit_1.apiLimiter, routes_1.default);
    app.use(error_1.notFound);
    app.use(error_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map