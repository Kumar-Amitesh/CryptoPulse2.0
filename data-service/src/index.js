import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/db.config.js';
import logger from './utils/logger.utils.js';

dotenv.config({
    path:'../../.env'
})

let server;

const PORT = process.env.PORT || 5000;

connectDB()
.then(() => {
    server = app.listen(PORT, () => {
        // logger.info(`Server is running on port ${PORT}`);
        console.log(`Server is running on port ${PORT}`);
    })

    server.on('error', (err) => {
        // logger.error(`Server error: ${err.message}`);
        console.error(`Server error: ${err.message}`);
        process.exit(1);
    });
})
.catch((err) => {
    // logger.error("MONGO db connection failed !!! ", err);
    console.error("MONGO db connection failed !!! ", err);
    process.exit(1);
})

// Graceful Shutdown Function
const shutdown = async (signal) => {
  // logger.info(`${signal} received. Shutting down gracefully...`);
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => { // Stop accepting new connections
      // logger.info('HTTP server closed.');
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false); // Close DB connection
        // logger.info('MongoDB connection closed.');
        console.log('MongoDB connection closed.');
        // If you have a shared Redis client instance you manage, close it here:
        await redisClient.quit();
        // logger.info('Redis connection closed.');
        process.exit(0); // Exit successfully
      } catch (err) {
        // logger.error('Error during shutdown:', err);
        console.error('Error during shutdown:', err);
        process.exit(1); // Exit with error
      }
    });
  } else {
      // If server never started, just try closing DB if connection was attempted
      try {
         if (mongoose.connection.readyState !== 0) { // Check if connection attempt was made
            await mongoose.connection.close(false);
            // logger.info('MongoDB connection closed.');
            console.log('MongoDB connection closed.');
         }
         process.exit(0);
      } catch (err) {
         // logger.error('Error closing MongoDB during initial shutdown:', err);
         console.error('Error closing MongoDB during initial shutdown:', err);
         process.exit(1);
      }
  }

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    // logger.error('Could not close connections in time, forcing shutdown.');
    console.error('Could not close connections in time, forcing shutdown.');
    process.exit(1);
  }, 10000); // e.g., 10-second timeout
};

// Listen for termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));