"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const prisma_1 = require("./config/prisma");
const socket_1 = require("./lib/socket");
async function main() {
    await prisma_1.prisma.$connect();
    console.log('✅ Database connected');
    const app = (0, app_1.createApp)();
    const httpServer = node_http_1.default.createServer(app);
    (0, socket_1.initSocket)(httpServer);
    const server = httpServer.listen(env_1.env.PORT, () => {
        console.log(`🚀 API ready on http://localhost:${env_1.env.PORT}/api  (${env_1.env.NODE_ENV})`);
    });
    const shutdown = (signal) => {
        console.log(`\n${signal} received — shutting down…`);
        server.close(async () => {
            await prisma_1.prisma.$disconnect();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
main().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
process.on('unhandledRejection', reason => console.error('Unhandled rejection:', reason));
//# sourceMappingURL=server.js.map