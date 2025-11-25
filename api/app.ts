/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import paymentsRoutes from './routes/payments.js'
import squareRoutes from './routes/square.js'
import agoraRoutes from './routes/agora.js'
import platformFeesRoutes from './platform-fees.js'
import adminRoutes from './routes/admin.js'
import payoutsRoutes from './routes/payouts.js'
import wheelRoutes from './routes/wheel.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb', verify: (req: any, _res, buf) => { req.rawBody = buf } }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'self'")
  next()
})

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/square', squareRoutes)
app.use('/api/agora', agoraRoutes)
app.use('/api/platform-fees', platformFeesRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payouts', payoutsRoutes)
app.use('/api/wheel', wheelRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('api-error', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
