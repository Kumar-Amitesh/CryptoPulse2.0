import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../../utils/logger.utils.js';
import ApiError from '../../utils/ApiError.utils.js';

dotenv.config({ path: '../../../../.env' }); 

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL;

if (!AUTH_SERVICE_URL || !DATA_SERVICE_URL) {
    const errorMsg = "FATAL ERROR: AUTH_SERVICE_URL or DATA_SERVICE_URL is not defined in environment variables for GraphQL client.";
    logger.error(errorMsg);
    console.error(errorMsg);
    // You might want to throw or handle this more gracefully depending on startup sequence
    // process.exit(1);
}

const authServiceClient = axios.create({ baseURL: AUTH_SERVICE_URL });
const dataServiceClient = axios.create({ baseURL: DATA_SERVICE_URL });

/**
 * Makes a request to a microservice.
 * @param {axios.AxiosInstance} client - The axios client instance for the service.
 * @param {string} method - HTTP method ('get', 'post', 'put', 'delete').
 * @param {string} path - The API path (e.g., '/api/v1/users/current-user').
 * @param {object} [options] - Optional configuration.
 * @param {object} [options.data] - Request body data for POST/PUT.
 * @param {object} [options.params] - URL query parameters.
 * @param {object} [options.headers] - Additional request headers.
 * @param {object} [context] - The GraphQL context, potentially containing user info.
 * @returns {Promise<any>} - The data from the service response.
 * @throws {ApiError} - Throws ApiError on request failure or non-2xx response.
 */
const requestService = async (client, method, path, options = {}, context = {}) => {
    const { data, params, headers = {} } = options;
    const { user } = context;

    // Add User ID header if available in context
    if (user && user._id) {
        headers['X-User-ID'] = user._id;
    }

    // Include cookies from original request if necessary for session/auth forwarding
    // Be cautious with forwarding all cookies due to security implications.
    // if (context.req && context.req.headers.cookie) {
    //     headers['Cookie'] = context.req.headers.cookie;
    // }


    logger.debug(`[GraphQL Resolver] Requesting ${method.toUpperCase()} ${client.defaults.baseURL}${path}`, { params, data, headers: { ...headers, Authorization: headers.Authorization ? 'Bearer [REDACTED]' : undefined } });

    try {
        const response = await client.request({
            method,
            url: path,
            data,
            params,
            headers,
            // Forward relevant cookies if needed
        });

        // Assuming services return data in a consistent structure like { success: true, data: ..., message: ... }
        // Adjust based on your actual microservice response structure
        if (response.data && (response.status >= 200 && response.status < 300)) {
             // Check if the service response follows the ApiResponse structure
            if (response.data.hasOwnProperty('data') && response.data.hasOwnProperty('success') && response.data.success) {
                 logger.debug(`[GraphQL Resolver] Success response from ${method.toUpperCase()} ${path}. Status: ${response.status}`);
                 return response.data.data; // Return the actual data payload
            } else if (response.data.hasOwnProperty('status') && response.data.status === 'UP') {
                 // Handle health check responses specifically if needed
                 logger.debug(`[GraphQL Resolver] Health check OK for ${method.toUpperCase()} ${path}. Status: ${response.status}`);
                 return response.data;
            } else {
                 // If the structure is different but status is 2xx, return the whole data
                 logger.warn(`[GraphQL Resolver] Unexpected success response structure from ${method.toUpperCase()} ${path}. Status: ${response.status}. Returning full data.`);
                 return response.data;
            }
        } else {
             // Handle cases where response.data might be missing or status indicates an issue
            const errorMessage = response.data?.message || `Service request failed with status ${response.status}`;
             logger.error(`[GraphQL Resolver] Error response from ${method.toUpperCase()} ${path}. Status: ${response.status}. Message: ${errorMessage}`);
            throw new ApiError(response.status, errorMessage, response.data?.errors || []);
        }

    } catch (error) {
        let statusCode = 500;
        let message = `Failed to ${method} ${path}`;
        let errors = [];

        if (error.response) {
            // Error response from the microservice
            statusCode = error.response.status || 500;
            message = error.response.data?.message || error.message;
            errors = error.response.data?.errors || [];
             logger.error(`[GraphQL Resolver] Service error: ${statusCode} from ${method.toUpperCase()} ${path}. Message: ${message}`, { errorData: error.response.data });
        } else if (error.request) {
            // Request made but no response received (network error, timeout)
            statusCode = 503; // Service Unavailable
            message = `Service unavailable: No response received from ${method.toUpperCase()} ${path}. ${error.message}`;
            logger.error(`[GraphQL Resolver] Network error: ${message}`);
        } else {
            // Setup error or other unexpected error
             message = `Error setting up request to ${method.toUpperCase()} ${path}: ${error.message}`;
             logger.error(`[GraphQL Resolver] Request setup error: ${message}`);
        }

        // Re-throw as ApiError for consistent GraphQL error handling
        throw new ApiError(statusCode, message, errors);
    }
};

export { authServiceClient, dataServiceClient, requestService };
