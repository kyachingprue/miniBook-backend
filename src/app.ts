import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { corsOptions } from './config/cors'
import { env } from './config/env'
import { errorHandler, notFound } from './middleware/error'
import { apiLimiter } from './middleware/rateLimit'
import routes from './routes'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1) // correct client IPs behind Render / Railway / Vercel / Nginx
  app.disable('x-powered-by')

  // Images/videos are loaded cross-origin by the web + mobile apps
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  // 🔑 CLIENT_URL in .env lists the web frontend(s); native apps send no Origin and are always allowed
  app.use(cors(corsOptions))
  app.options('/{*path}', cors(corsOptions))
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  if (!env.isProd) app.use(morgan('dev'))

  app.use('/api', apiLimiter, routes)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
