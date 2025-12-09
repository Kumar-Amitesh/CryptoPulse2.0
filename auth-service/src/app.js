import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose';
import { client as redisClient } from './config/redis.config.js';
import logger from './utils/logger.utils.js';
import morgan from 'morgan';

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "5kb"}))
app.use(express.urlencoded({extended: true, limit: "5kb"}))
app.use(express.static('public'))
app.use(cookieParser())
app.use(helmet())
app.set("trust proxy", 1);

morgan.token('req-id', (req) => req.header('X-Request-ID') || '-');
morgan.token('remote-addr', (req) => req.ip || req.connection?.remoteAddress || '-');

const morganFormat = ':req-id :remote-addr :method :url :status :res[content-length] - :response-time ms :user-agent';

app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        if (logger && typeof logger.http === "function")
          logger.http(message.trim());
        else console.info(message.trim());
      },
    },
    skip: (req) => req.path === "/api/v1/users/health", 
  })
);

const limiter = rateLimit({
    windowMs: 60 * 1000,  
    limit:50,
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429
})
app.use(limiter)

// import routes
import userRouter from './routes/user.routes.js'

//routes declaration
app.use('/api/v1/users',userRouter)

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { stack: err.stack, statusCode: err.statusCode });

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || []
    });
});

app.get('/api/v1/users/health', async (req, res) => {
  try {
    await redisClient.ping();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB not connected');
    }

    res.status(200).json({ status: 'UP', services: { redis: 'UP', mongodb: 'UP' } });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ status: 'DOWN', error: error.message });
  }
});

export default app