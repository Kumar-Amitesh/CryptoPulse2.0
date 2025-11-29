import { client as redisClient } from '../config/redis.config.js';
import logger from '../utils/logger.utils.js';

// Cache expiry time in seconds
const CACHE_EXPIRY_SECONDS = 120; 

const cacheMiddleware = async (req, res, next) => {
    if (!redisClient.isReady) {
        logger.warn('Cache unavailable. Bypassing caching middleware.');
        return next();
    }

    if (req.method !== 'GET') {
        return next();
    }
    
    // Create a cache key based on the full URL (path + query params)
    const cacheKey = `response-cache:${req.originalUrl}`;
    
    try {
        // Check Cache
        const cachedResponse = await redisClient.get(cacheKey);

        if (cachedResponse) {
            logger.debug(`[Cache Hit] for ${req.originalUrl}`);
            const { statusCode, body } = JSON.parse(cachedResponse);

            // Send the cached response
            res.setHeader('X-Cache-Status', 'HIT');
            return res.status(statusCode).send(body);
        }

        logger.debug(`[Cache Miss] for ${req.originalUrl}`);
        res.setHeader('X-Cache-Status', 'MISS');

        // Wrap response to capture body
        const originalSend = res.send;

        let capturedResponse = null; 

        res.send = function (body) {
            // Only cache successful 200 responses
            if (res.statusCode === 200) {
                // Ensure the body is a string before storing (Express/Proxy might pass Buffer or object)
                const bodyString = typeof body === 'object' ? JSON.stringify(body) : body.toString();

                capturedResponse = {
                    statusCode: res.statusCode,
                    body: bodyString 
                };

                // Store in Redis (Do not await - perform asynchronously)
                redisClient.set(cacheKey, JSON.stringify(capturedResponse), { EX: CACHE_EXPIRY_SECONDS })
                    .catch(err => logger.error(`[Cache Set Error] for ${cacheKey}: ${err.message}`));
            } else {
                 logger.debug(`[Cache Skip] Status ${res.statusCode} for ${req.originalUrl}. Not caching.`);
            }

            // Restore original res.send and call it to send the response to the client
            res.send = originalSend;
            return res.send(body);
        };

        // Continue to downstream handler (proxy)
        next();

    } catch (error) {
        // Log the error but fail-open (continue to the proxy)
        logger.error(`[Caching Middleware Error] for ${req.originalUrl}: ${error.message}`);
        res.setHeader('X-Cache-Status', 'ERROR');
        next();
    }
};

export default cacheMiddleware;