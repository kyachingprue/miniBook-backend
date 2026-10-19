"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("./env");
// One shared client for the whole app
// Also survives tsx watch reloads in development
const globalForPrisma = globalThis;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is missing from environment variables');
}
const adapter = new adapter_pg_1.PrismaPg({
    connectionString
});
const createPrismaClient = () => new client_1.PrismaClient({
    adapter,
    log: env_1.env.isProd ? ['error'] : ['warn', 'error']
});
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (!env_1.env.isProd) {
    globalForPrisma.prisma = exports.prisma;
}
//# sourceMappingURL=prisma.js.map