import { client as redisClient, subscriber } from '../config/redis.config.js';
import logger from '../utils/logger.utils.js';
import { REDIS_COIN_UPDATE_CHANNEL } from '../constants.js';
import jwt from 'jsonwebtoken'; 

// Store user sockets (simple in-memory, consider Redis for scalability)
// const userSockets = new Map(); // Map<userId, Set<socketId>>
// const socketUsers = new Map(); // Map<socketId, userId>

export function initializeWebSocket(io) {
    // Middleware for authentication
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
        if (!token) {
            logger.warn(`WS: Connection attempt without token from ${socket.id}`);
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            socket.user = { _id: decoded._id }; // Attach user ID to the socket
            logger.info(`WS: User ${socket.user._id} authenticated for socket ${socket.id}`);
            next();
        } catch (err) {
            logger.error(`WS: Authentication failed for socket ${socket.id}: ${err.message}`);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user._id;
        logger.info(`WS: User ${userId} connected with socket ID: ${socket.id}`);

        // Store the mapping
        // if (!userSockets.has(userId)) {
        //     userSockets.set(userId, new Set());
        // }
        // userSockets.get(userId).add(socket.id);
        // socketUsers.set(socket.id, userId);

        // Join a user-specific room
        socket.join(userId);
        logger.debug(`WS: Socket ${socket.id} joined room ${userId}`);

        // Handle client requests (e.g., subscribe to specific coins - more advanced)
        socket.on('subscribeToCoin', (coinId) => {
            // Potentially join a coin-specific room
            // socket.join(`coin:${coinId}`);
            logger.debug(`WS: Socket ${socket.id} requested subscription to ${coinId} (basic implementation, room not joined)`);
            // You might fetch initial data here if needed
        });


        socket.on('disconnect', (reason) => {
            // const disconnectedUserId = socketUsers.get(socket.id);
            // logger.info(`WS: User ${disconnectedUserId} disconnected (Socket ID: ${socket.id}). Reason: ${reason}`);

            const userId = socket.user?._id || 'unknown';
            logger.info(`WS: User ${userId} disconnected (Socket ID: ${socket.id}). Reason: ${reason}`);

            // Clean up mappings
            // socketUsers.delete(socket.id);
            // if (disconnectedUserId && userSockets.has(disconnectedUserId)) {
            //     userSockets.get(disconnectedUserId).delete(socket.id);
            //     if (userSockets.get(disconnectedUserId).size === 0) {
            //         userSockets.delete(disconnectedUserId);
            //     }
            // }
        });
    });

    // Subscribe to Redis updates
    subscriber.subscribe(REDIS_COIN_UPDATE_CHANNEL, (message) => {
        try {
            const updateData = JSON.parse(message); // Expecting { coinId: 'bitcoin', data: { updated coin object } }
             logger.debug(`WS: Received coin update from Redis: ${updateData.coinId}`);

            // --- Logic to determine who needs this update ---

            // Option 1: Broadcast to everyone (simple, less efficient)
            // io.emit('coinUpdate', updateData);

            // Option 2: Broadcast only to users watching this coin (Requires tracking user watchlist)
            // This is more complex. A simpler approach is to let the frontend filter.

            // Option 3: Broadcast based on rooms (if users join coin-specific rooms)
            // io.to(`coin:${updateData.coinId}`).emit('coinUpdate', updateData);

            // general broadcast, frontend filters
            // io.emit('coinUpdate', updateData); // Send { coinId: '...', data: {...} }
            setTimeout(() => {
                io.emit('coinUpdate', updateData); // Send { coinId: '...', data: {...} }
            }, 300); // slight delay to ensure socket readiness

        } catch (err) {
            logger.error(`WS: Error processing Redis message: ${err.message}`, message);
        }
    });

    logger.info(`WS: Subscribed to Redis channel: ${REDIS_COIN_UPDATE_CHANNEL}`);
    console.log(`WS: Subscribed to Redis channel: ${REDIS_COIN_UPDATE_CHANNEL}`);
}