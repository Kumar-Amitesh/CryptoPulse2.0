import axios from 'axios'
import axiosRetry from 'axios-retry'
import dotenv from 'dotenv'
import Opossum from 'opossum' // Circuit breaker library
import logger from './logger.utils.js'

dotenv.config({
    path:'../../.env'
})

const Api = axios.create({
    baseURL: process.env.CoinGecko_URL_COIN,
    headers:{
        'x-cg-api-key':process.env.CoinGecko_API_KEY
    }
})

// --- Add Retry Logic ---
axiosRetry(Api, {
    retries: 3, // Number of retries-> total attempts = 1 initial + 3 retries
    
    // The function to determine the delay between retries
    // This will do 1s, 2s, 4s
    retryDelay: (retryCount) => {
        console.log(`Retry attempt ${retryCount}`);
        return axiosRetry.exponentialDelay(retryCount, 100); // 100ms base delay
    },
    
    // The condition to check if a retry should be performed
    // retryCondition: (error) => {
    //     // We only want to retry on network errors or server-side (5xx) errors
    //     // or if we get a rate limit (429)
    //     return (
    //         axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    //         error.response?.status === 429
    //     );
    // },

    retryCondition: (error) => {
        const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429; // retry on rate limit
        if (shouldRetry) {
        logger.warn(
            `WORKER-AXIOS: Retrying due to ${error.code || error.response?.status}`
        );
        }
        return shouldRetry;
    },

    // A callback to log each retry attempt
    onRetry: (retryCount, error, requestConfig) => {
        logger.warn(
        `WORKER-AXIOS: [Retry Attempt ${retryCount}] URL: ${requestConfig.url}, Error: ${error.message}`
        );
    },
});

// --- Circuit Breaker Options ---
const circuitBreakerOptions = {
  timeout: 5000, // mark as failure if takes longer than 5s
  errorThresholdPercentage: 50, // open circuit after 50% failures
  resetTimeout: 30000, // after 30s, allow trial request again
};

// --- Function Wrapped by Circuit Breaker ---
const circuitBreaker = new Opossum(
  async (config) => {
    // use Axios instance internally
    return await Api.get(config.url, config);
  },
  circuitBreakerOptions
);


// --- Circuit Breaker Event Logging ---
circuitBreaker.on('open', () => {
  logger.error(
    'WORKER-AXIOS: Circuit Breaker Opened. Requests to CoinGecko will fail fast.'
  );
});
circuitBreaker.on('halfOpen', () => {
  logger.warn(
    'WORKER-AXIOS: Circuit Breaker Half-Open. Testing next request.'
  );
});
circuitBreaker.on('close', () => {
  logger.info('WORKER-AXIOS: Circuit Breaker Closed. Requests back to normal.');
});
circuitBreaker.on('failure', (error) => {
  if (error.name !== 'OpenCircuitError' && error.name !== 'TimeoutError') {
    logger.warn(`WORKER-AXIOS: Failure recorded: ${error.message}`);
  }
});


// --- Protected API Wrapper ---
const api = {
  /**
   * GET request protected by retry + circuit breaker
   * @param {string} url - The endpoint URL (relative to baseURL)
   * @param {object} config - Optional Axios config (params, headers, etc.)
   * @returns {Promise<AxiosResponse>}
   */
  get: async (url, config = {}) => {
    const axiosConfig = { ...config, url };
    try {
      const response = await circuitBreaker.fire(axiosConfig);
      return response;
    } catch (error) {
      logger.error(
        `WORKER-AXIOS: Circuit Breaker caught error for GET ${url}: ${error.message}`
      );
      throw error; // rethrow so caller can handle it
    }
  },

  /**
   * (Optional) Example for future expansion
   * Each method can have its own breaker if needed.
   */
  // post: async (url, data, config = {}) => {
  //   const axiosConfig = { ...config, url, data };
  //   try {
  //     return await circuitBreaker.fire(axiosConfig);
  //   } catch (error) {
  //     logger.error(`WORKER-AXIOS: POST ${url} failed: ${error.message}`);
  //     throw error;
  //   }
  // },
};

export default api