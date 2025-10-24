import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import connectDB from './config/db.config.js'; 
import { updateTopCoinsJob, updateWatchlistCoinsJob } from './controllers/coin.controllers.js'; 
import { client as redisClient } from './config/redis.config.js'; 

dotenv.config({ path: '../../.env' });

const redisConnection = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME, 
    password: process.env.REDIS_PASSWORD, 
    // Important: BullMQ needs its own connection, separate from the one used in jobs if using 'redis' v4 client
    // For simplicity here, assume the same config works, but for production consider ioredis or separate clients.
    maxRetriesPerRequest: null // Required for redis v4+ compatibility with BullMQ v5+
};

const QUEUE_NAME = 'crypto-tasks';

// --- Job Names (must match scheduler) ---
const JOB_UPDATE_TOP_COINS = 'update-top-coins';
const JOB_UPDATE_WATCHLIST = 'update-watchlist';

let worker; // Keep worker reference for graceful shutdown

async function startWorker() {
    console.log('Connecting to Database...');
    await connectDB();
    console.log('Database connected.');

    // Connect the redis client used by the jobs themselves
    // Ensure redis.config.js handles connection
    // if (!redisClient.isReady) {
    //     try {
    //          await redisClient.connect();
    //          console.log('Job Redis client connected.');
    //     } catch (err) {
    //         console.error('Failed to connect Job Redis client:', err);
    //         process.exit(1);
    //     }
    // }


    console.log('Initializing BullMQ Worker...');

    worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            // function called when a job is processed
            console.log(`[${new Date().toISOString()}] Processing job: ${job.name} (ID: ${job.id})`);

            try {
                switch (job.name) {
                    case JOB_UPDATE_TOP_COINS:
                        await updateTopCoinsJob();
                        break;
                    case JOB_UPDATE_WATCHLIST:
                        await updateWatchlistCoinsJob();
                        break;
                    default:
                        console.warn(`Unknown job name received: ${job.name}`);
                        throw new Error(`Unknown job: ${job.name}`);
                }
                console.log(`[${new Date().toISOString()}] Completed job: ${job.name} (ID: ${job.id})`);
                // BullMQ handles it on successful promise resolution
            } catch (error) {
                 console.error(`[${new Date().toISOString()}] Failed job: ${job.name} (ID: ${job.id})`, error);
                 // Throw the error again so BullMQ knows the job failed and can handle retries/failure logic
                 throw error;
            }
        },
        {
            connection: redisConnection,
            concurrency: 5, // Process up to 5 jobs concurrently 
            removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
            removeOnFail: { count: 5000 } // Keep last 5000 failed jobs
        }
    );

    // --- Worker Event Listeners ---
    worker.on('completed', (job, result) => {
        console.log(`Job ${job.id} (${job.name}) completed successfully.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} (${job?.name}) failed with error: ${err.message}`, err.stack);
    });

     worker.on('error', err => {
        // Local errors, like Redis connection issues
        console.error('Worker encountered an error:', err);
    });

    console.log('Worker started and waiting for jobs...');
}


startWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

// --- Graceful Shutdown ---
async function shutdown() {
    console.log('Shutting down worker...');
    if (worker) {
        await worker.close();
    }
     if (redisClient && redisClient.isReady) {
        await redisClient.quit();
    }
    console.log('Worker closed.');
    process.exit(0);
}

process.on('SIGTERM', shutdown); 
process.on('SIGINT', shutdown); 