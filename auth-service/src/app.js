import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose';
import { redisClient } from './config/redis.config.js';

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

const limiter = rateLimit({
    windowMs: 15*60*1000,  
    limit:10,
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

app.get('/api/v1/health', async (req, res) => {
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