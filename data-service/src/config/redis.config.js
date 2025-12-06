import { createClient } from 'redis'
import logger from '../utils/logger.utils.js'
import dotenv from 'dotenv'
dotenv.config({
    path: '../../.env'
})

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
})

client.on('error', (err) => {
    logger.error(`Redis client error: ${err.message}`);
})
client.on('ready', () => {
    logger.info('Redis client is ready');
});


const connectRedis = async()=>{
    try{
        await client.connect();
        console.log(`Redis connected: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    }
    catch(error){
        logger.error(`Redis connection failed: ${error.message}`);
        process.exit(1);
    }
}
// connectRedis()

export { connectRedis, client };