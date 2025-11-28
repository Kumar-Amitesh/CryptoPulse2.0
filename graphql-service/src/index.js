import app from './app.js';
import dotenv from 'dotenv';
import logger from './utils/logger.utils.js';
import connectDB from './config/db.config.js';

dotenv.config({
    path:'../../.env'
})

const PORT = 8003; 

let server;

connectDB()
.then(() => {
    server = app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
        console.log(`Server is running on port ${PORT}`);
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

// Graceful Shutdown Function (Simplified as no DB/Redis connections here)
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(() => { 
      logger.info('HTTP server closed.');
      console.log('HTTP server closed.');
      process.exit(0); 
    });
  } else {
      process.exit(0);
  }

  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown.');
    console.error('Could not close connections in time, forcing shutdown.');
    process.exit(1);
  }, 10000); 
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));