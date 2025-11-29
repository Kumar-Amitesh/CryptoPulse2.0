import { client as redisClient } from '../config/redis.config.js';
import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import logger from '../utils/logger.utils.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); 

// Rate Limit Configuration
const RATE_LIMIT_WINDOW_SECONDS = 60; 
const RATE_LIMIT_PLANS = {
    free: {
        limit: 100 // requests per window
    },
    premium: {
        limit: 1000 
    }
};

const userRateLimiter = asyncHandler(async (req, res, next) => {
    if (!redisClient || !redisClient.isReady) {
        logger.error('Rate limiter cannot connect to Redis. Allowing request.');
        // returning a 503 Service Unavailable error
        throw new ApiError(503, 'Rate limiting service unavailable.');
        // return next();
    }

    if (!req.user || !req.user._id) {
        logger.warn('User ID not found in request for rate limiting.');
        return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user._id;
    // Determine user's plan and corresponding limit
    const plan = req.user.plan && RATE_LIMIT_PLANS[req.user.plan] ? req.user.plan : 'free';
    const { limit } = RATE_LIMIT_PLANS[plan];

    const key = `rate-limit:${userId}`;

    try {
        const currentCount = await redisClient.incr(key);

        // Set expiry on first increment
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
        next();
    }
});

export default userRateLimiter;