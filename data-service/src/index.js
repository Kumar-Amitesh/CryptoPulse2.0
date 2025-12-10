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

import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/db.config.js';
import mongoose from 'mongoose';
import { client as redisClient } from './config/redis.config.js';
import buildIndex from './utils/buildIndex.utils.js';

dotenv.config({
    path:'../../.env'
})

let server;

const PORT = 8002;

connectDB()
.then(() => {
    server = app.listen(PORT, async () => {
        logger.info(`Server is running on port ${PORT}`);
        console.log(`Server is running on port ${PORT}`);

        try {
            await buildIndex();
            logger.info("Initial index build completed.");
        } catch (err) {
            logger.error("Error in initial index build:", err);
        }

        setTimeout(async () => {
            try {
                await buildIndex();
                logger.info("Scheduled index rebuild completed.");
            } catch (err) {
                logger.error("Error in scheduled index rebuild:", err);
            }
        }, 120000);
    })

    server.on('error', (err) => {
        logger.error(`Server error: ${err.message}`);
        console.error(`Server error: ${err.message}`);
        process.exit(1);
    });
})
.catch((err) => {
    logger.error("MONGO db connection failed !!! ", err);
    console.error("MONGO db connection failed !!! ", err);
    process.exit(1);
})


// Graceful Shutdown Function
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => { 
      logger.info('HTTP server closed.');
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false); // Close DB connection
        logger.info('MongoDB connection closed.');
        console.log('MongoDB connection closed.');
        await redisClient.quit();
        logger.info('Redis connection closed.');
        process.exit(0); // Exit successfully
      } catch (err) {
        logger.error('Error during shutdown:', err);
        console.error('Error during shutdown:', err);
        process.exit(1); // Exit with error
      }
    });
  } else {
      try {
         if (mongoose.connection.readyState !== 0) { // Check if connection attempt was made
            await mongoose.connection.close(false);
            logger.info('MongoDB connection closed.');
            console.log('MongoDB connection closed.');
         }
         process.exit(0);
      } catch (err) {
         logger.error('Error closing MongoDB during initial shutdown:', err);
         console.error('Error closing MongoDB during initial shutdown:', err);
         process.exit(1);
      }
  }

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown.');
    console.error('Could not close connections in time, forcing shutdown.');
    process.exit(1);
  }, 10000); 
};

// Listen for termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));