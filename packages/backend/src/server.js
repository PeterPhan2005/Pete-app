import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { connectDB } from './libs/db.js';
import { connectRedisCache } from './config/redis.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import { startAllWorkers } from './workers/index.js';
import authRoute from './routes/authRoute.js';
import userRoute from './routes/userRoute.js';
import friendRoute from './routes/friendRoute.js';
import messageRoute from './routes/messageRoute.js';
import conversationRoute from './routes/conversationRoute.js';
import callRoute from './routes/callRoute.js';
import { protectedRoute } from './middlewares/authMiddleware.js';
import { errorHandler } from './utils/errorHandler.js';
import { io, app, server } from './socket/index.js';
import Call from './models/Call.js';

// Load environment variables
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = [
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'MONGODB_URI',
  'CLIENT_URL',
  'NODE_ENV'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Validate JWT secrets length
if (process.env.ACCESS_TOKEN_SECRET.length < 32) {
  console.error('❌ ACCESS_TOKEN_SECRET must be at least 32 characters long');
  process.exit(1);
}

if (process.env.REFRESH_TOKEN_SECRET.length < 32) {
  console.error('❌ REFRESH_TOKEN_SECRET must be at least 32 characters long');
  process.exit(1);
}

// Get PORT from environment
const PORT = process.env.PORT || 5000;

// CORS configuration with whitelist
const allowedOrigins = process.env.CLIENT_URL.split(',').map(url => url.trim());

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
// Security headers
app.use(helmet());
// Request logging
app.use(morgan('combined'));

// Health check endpoint (no authentication required)
app.get('/api/health', (_req, res) => {
  const instanceId = process.env.INSTANCE_ID || 'unknown';
  res.status(200).json({
    status: 'healthy',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: 'connected'
  });
});

//public routes
app.use('/api/auth', authRoute);

//private routes (protected) - Apply middleware only to these routes
app.use("/api/user", protectedRoute, userRoute);
app.use("/api/friend", protectedRoute, friendRoute);
app.use("/api/conversation", protectedRoute, conversationRoute);
app.use("/api/message", protectedRoute, messageRoute);
app.use("/api/call", protectedRoute, callRoute);

// Global error handler - must be last
app.use(errorHandler);

// Connect to Database, Redis, and RabbitMQ
Promise.all([
  connectDB(),
  connectRedisCache(),
  connectRabbitMQ()
]).then(async () => {
  // Start RabbitMQ workers
  await startAllWorkers();

  // Auto-end stale calls every 2 minutes
  setInterval(async () => {
    try {
      const endedCount = await Call.autoEndStaleCalls();
      if (endedCount > 0) {
        console.log(`⏰ Auto-ended ${endedCount} stale call(s)`);
      }
    } catch (err) {
      console.error('Error auto-ending stale calls:', err);
    }
  }, 2 * 60 * 1000); // 2 minutes

  // Start the server after DB, Redis, and RabbitMQ connections are established
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket: Ready for connections`);
    console.log(`💾 Redis Cache: Connected`);
    console.log(`🐰 RabbitMQ Workers: Running`);
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Export io for use in controllers (emitting events)
export { io };
