// import { createClient } from 'redis';
import { client as redisClient } from '../config/redis.config.js';
import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import logger from '../utils/logger.utils.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); // Ensure .env is loaded

// --- Redis Client (Consider creating a shared Redis config/client) ---
// Note: This creates a separate client connection for the middleware.
// For better resource management, you might want to import a shared client instance.
// let redisClient;
// try {
//     redisClient = createClient({
//         // Add your Redis connection details from .env here if needed
//         // e.g., username, password, socket: { host, port }
//         // Ensure error handling and connection logic as in your other redis.config.js files
//     });
//     redisClient.on('error', (err) => logger.error('Rate Limit Redis Client Error:', err));
//     await redisClient.connect();
//     logger.info('Rate Limit Redis Client Connected.');
// } catch (err) {
//     logger.error('Failed to connect Rate Limit Redis Client:', err);
//     // Decide how to handle this - maybe allow requests but log errors, or block?
//     // For now, we'll let it proceed but log the error. The middleware will fail later.
// }
// --- End Redis Client ---

// --- Rate Limit Configuration ---
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window
const RATE_LIMIT_PLANS = {
    free: {
        limit: 100 // requests per window
    },
    premium: {
        limit: 1000 // requests per window
    }
};
// --- End Configuration ---

const userRateLimiter = asyncHandler(async (req, res, next) => {
    if (!redisClient || !redisClient.isReady) {
        logger.error('Rate limiter cannot connect to Redis. Allowing request.');
        // Potentially dangerous to allow all requests if Redis is down.
        // Consider returning a 503 Service Unavailable error instead:
        throw new ApiError(503, 'Rate limiting service unavailable.');
        // return next();
    }

    if (!req.user || !req.user._id) {
        // Should not happen if used after verifyJWT, but good practice to check
        logger.warn('User ID not found in request for rate limiting.');
        return next(); // Or apply IP-based limiting here as a fallback
    }

    const userId = req.user._id;
    // Safely get the plan, default to 'free' if missing or invalid
    const plan = req.user.plan && RATE_LIMIT_PLANS[req.user.plan] ? req.user.plan : 'free';
    const { limit } = RATE_LIMIT_PLANS[plan];

    const key = `rate-limit:${userId}`;

    try {
        const currentCount = await redisClient.incr(key);

        // Set expiry only on the first request in the window
        if (currentCount === 1) {
            await redisClient.expire(key, RATE_LIMIT_WINDOW_SECONDS);
        }

        const ttl = await redisClient.ttl(key); // Time to live for the key

        // Set headers for the client
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount));
        res.setHeader('X-RateLimit-Reset', Math.max(0, ttl)); // Seconds until reset

        if (currentCount > limit) {
            logger.warn(`Rate limit exceeded for user ${userId} (Plan: ${plan}). Count: ${currentCount}, Limit: ${limit}`);
            throw new ApiError(429, 'Too many requests, please try again later.');
        }

        next();
    } catch (error) {
        logger.error(`Error in rate limiting middleware for user ${userId}:`, error);
        // Don't block the user due to a rate limiter error, but log it
        next();
    }
});

export default userRateLimiter;