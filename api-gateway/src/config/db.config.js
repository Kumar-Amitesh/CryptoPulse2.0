import mongoose from 'mongoose';
import {DB_NAME} from '../constants.js';
// import logger from '../utils/logger.utils.js';

const connectDB = async()=>{
    try{
        const URI = `${process.env.MONGO_URI.replace('/?',`/${DB_NAME}?`)}`
        const connectInstance = await mongoose.connect(URI)
        // logger.info(`MongoDB connected: ${connectInstance.connection.host}`);
        console.log(`MongoDB connected: ${connectInstance.connection.host}`);
    }
    catch(err){
        // logger.error(`MongoDB connection failed ${err.message}`)
        console.error(`MongoDB connection failed ${err.message}`);
        process.exit(1);
    }
}
export default connectDB