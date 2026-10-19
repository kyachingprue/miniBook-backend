import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from './env'

// One shared client for the whole app
// Also survives tsx watch reloads in development
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is missing from environment variables')
}

const adapter = new PrismaPg({
  connectionString
})

const createPrismaClient = () =>
  new PrismaClient({
    adapter,
    log: env.isProd ? ['error'] : ['warn', 'error']
  })

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (!env.isProd) {
  globalForPrisma.prisma = prisma
}
