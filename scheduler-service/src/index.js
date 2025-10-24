import pkg from 'bullmq';
const { Queue } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });

// Redis connection details
const redisConnection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
};

const QUEUE_NAME = 'crypto-tasks';

// Job names
const JOB_UPDATE_TOP_COINS = 'update-top-coins';
const JOB_UPDATE_WATCHLIST = 'update-watchlist';

// Create the Queue
const cryptoTasksQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});
console.log(`Queue '${QUEUE_NAME}' initialized.`);

// Add repeatable jobs
async function addRepeatableJobs() {
  const repeatableJobs = await cryptoTasksQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await cryptoTasksQueue.removeRepeatableByKey(job.key);
    console.log(`Removed existing repeatable job: ${job.name} (${job.key})`);
  }

  await cryptoTasksQueue.add(
    JOB_UPDATE_TOP_COINS,
    { task: JOB_UPDATE_TOP_COINS },
    {
      repeat: { pattern: '*/2 * * * *' },
      jobId: JOB_UPDATE_TOP_COINS,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
  console.log(`Added repeatable job: ${JOB_UPDATE_TOP_COINS} (every 2 minutes)`);

  await cryptoTasksQueue.add(
    JOB_UPDATE_WATCHLIST,
    { task: JOB_UPDATE_WATCHLIST },
    {
      repeat: { pattern: '*/5 * * * *' },
      jobId: JOB_UPDATE_WATCHLIST,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
  console.log(`Added repeatable job: ${JOB_UPDATE_WATCHLIST} (every 5 minutes)`);
}

async function startScheduler() {
  console.log('Starting BullMQ scheduler service...');
  await addRepeatableJobs();
  console.log('Scheduler running. Repeatable jobs configured.');
}

startScheduler().catch((error) => {
  console.error('Failed to start scheduler:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing queue...');
  await cryptoTasksQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received. Closing queue...');
  await cryptoTasksQueue.close();
  process.exit(0);
});
