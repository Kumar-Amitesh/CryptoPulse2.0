import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/db.config.js';
import logger from './utils/logger.utils.js';

dotenv.config({
    path:'../../.env'
})

const PORT = process.env.PORT || 5000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
    })
})
.catch((err) => {
    logger.error("MONGO db connection failed !!! ", err);
})