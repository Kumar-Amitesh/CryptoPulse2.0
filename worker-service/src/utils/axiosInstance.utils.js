import axios from 'axios'
import axiosRetry from 'axios-retry'
import dotenv from 'dotenv'

dotenv.config({
    path:'../.env'
})


const api = axios.create({
    baseURL: process.env.CoinGecko_URL_COIN,
    headers:{
        'x-cg-api-key':process.env.CoinGecko_API_KEY
    }
})

// --- Add Retry Logic ---
axiosRetry(api, {
    retries: 3, // Number of retries
    
    // The function to determine the delay between retries
    // This will do 1s, 2s, 4s
    retryDelay: (retryCount) => {
        console.log(`Retry attempt ${retryCount}`);
        return axiosRetry.exponentialDelay(retryCount, 100); // 100ms base delay
    },
    
    // The condition to check if a retry should be performed
    retryCondition: (error) => {
        // We only want to retry on network errors or server-side (5xx) errors
        // or if we get a rate limit (429)
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            error.response?.status === 429
        );
    },

    // Optional: A callback to log each retry attempt
    onRetry: (retryCount, error, requestConfig) => {
        console.log(`[Retry] Attempt ${retryCount} for ${requestConfig.url}`);
        console.log(`[Retry] Error: ${error.message}`);
    }
});

export default api