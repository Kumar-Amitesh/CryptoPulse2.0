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
    // How long we should remember the requests. Defaults to 60000 ms (= 1 minute).
    windowMs: 15*60*1000,    //15 minutes
    // The maximum number of connections to allow during the window before rate limiting the client.
    // Limit each IP to 10 requests per `window` (here, per 15 minutes).
    limit:10,
    // Response to return after limit is reached.
    message: 'Too many requests from this IP, please try again later.',
    // HTTP status code after limit is reached (default is 429).
    statusCode: 429
})
app.use(limiter)

// import routes
import userRouter from './routes/user.routes.js'

//routes declaration
app.use('/api/v1/users',userRouter)

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    // Log the error using your Winston logger
    logger.error(`Error: ${err.message}`, { stack: err.stack, statusCode: err.statusCode });

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Send a consistent JSON error response
    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || []
    });
});

app.get('/api/v1/health', async (req, res) => {
  try {
    // 1. Check Redis connection
    await redisClient.ping();
    // 2. Check MongoDB connection (Mongoose connection state)
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