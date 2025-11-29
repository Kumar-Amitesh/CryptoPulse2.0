import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.utils.js';
import { initializeWebSocket } from './websocket/handler.websocket.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { client as redisClient, subscriber as redisSubscriber } from './config/redis.config.js'; 
import morgan from 'morgan';

dotenv.config({ path: '../../.env' }); 

const app = express();
const httpServer = createServer(app);

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
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
    skip: (req) => req.path === "/metrics", 
  })
);

app.get('/api/v1/websocket/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'WebSocket service is running.' });
});

// Setup Socket.IO Server
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    },
    // Optional: configure transports if needed
    // transports: ['websocket', 'polling'],
});

// Configure Redis Adapter
if (redisClient.isReady && redisSubscriber.isReady) {
    io.adapter(createAdapter(redisClient, redisSubscriber));
    logger.info('Socket.IO Redis Adapter configured.');
} else {
    // This is problematic - the adapter needs connected clients.
    // Consider ensuring Redis connection happens before this point in index.js
    // or adding retry logic here. For now, log a critical error.
    logger.error('CRITICAL: Redis clients not ready when configuring Socket.IO adapter!');
    // process.exit(1);
}

initializeWebSocket(io);

// Global Error Handler for Express (won't catch WebSocket errors)
app.use((err, req, res, next) => {
    logger.error(`HTTP Error: ${err.message}`, { stack: err.stack, statusCode: err.statusCode });
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({ success: false, message: message });
});

export default httpServer;