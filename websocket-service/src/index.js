import logger from './utils/logger.utils.js';
import { connectRedis } from './config/redis.config.js';

try {
    await connectRedis();
    logger.info('Redis connected successfully.');
    console.log('Redis connected successfully.');
} catch (err) {
    logger.error('Failed to connect to Redis:', err);
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
}


import {httpServer, io} from './app.js';
import dotenv from 'dotenv';
import { client as redisClient, subscriber } from './config/redis.config.js';
import { initializeWebSocket } from './websocket/handler.websocket.js';
import { createAdapter } from '@socket.io/redis-adapter';

dotenv.config({ path: '../../.env' }); 

const PORT = 8004; 

let server;

async function startServer() {
    try {

        if (redisClient.isReady && subscriber.isReady) {
            io.adapter(createAdapter(redisClient, subscriber));
            logger.info('Socket.IO Redis Adapter configured.');
        } else {
            throw new Error('Redis connected but clients report not ready.');
        }

        initializeWebSocket(io);

        server = httpServer.listen(PORT, () => {
            logger.info(`WebSocket Server is running on port ${PORT}`);
            console.log(`WebSocket Server is running on port ${PORT}`);
        });

        server.on('error', (err) => {
            logger.error(`Server error: ${err.message}`);
            console.error(`Server error: ${err.message}`);
            process.exit(1);
        });

    } catch (err) {
        logger.error("Service startup failed!!! ", err);
        console.error("Service startup failed!!! ", err);
        process.exit(1);
    }
}

startServer();

// Graceful Shutdown
const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    console.log(`${signal} received. Shutting down gracefully...`);

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed.');
            console.log('HTTP server closed.');
            try {
                if (redisClient && redisClient.isReady) await redisClient.quit();
                if (subscriber && subscriber.isReady) await subscriber.quit();
                logger.info('Redis connections closed.');
                console.log('Redis connections closed.');

                process.exit(0);
            } catch (err) {
                logger.error('Error during shutdown:', err);
                console.error('Error during shutdown:', err);
                process.exit(1);
            }
        });
    } else {
         try {
             if (redisClient && redisClient.isReady) await redisClient.quit();
             if (subscriber && subscriber.isReady) await subscriber.quit();
             logger.info('Redis connections closed during initial shutdown.');
             console.log('Redis connections closed during initial shutdown.');
             process.exit(0);
         } catch(err){
              logger.error('Error closing Redis during initial shutdown:', err);
              console.error('Error closing Redis during initial shutdown:', err);
             process.exit(1);
         }
    }

    setTimeout(() => {
        logger.error('Could not close connections in time, forcing shutdown.');
        console.error('Could not close connections in time, forcing shutdown.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));