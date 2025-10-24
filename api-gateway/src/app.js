import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import verifyJWT from './middleware/auth.middleware.js';
import logger from './utils/logger.utils.js';

dotenv.config({
    path:'../../.env' 
});

const app = express();


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(cookieParser());
app.use(express.urlencoded({extended: true, limit: "5kb"}));
app.use(express.json());

// Service URLs 
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL;

console.log(`Auth Service URL: ${AUTH_SERVICE_URL}`);
console.log(`Data Service URL: ${DATA_SERVICE_URL}`);

// --- Create Proxy Instances ---

// Proxy for the Authentication Service
// const authServiceProxy = createProxyMiddleware({
//     target: AUTH_SERVICE_URL,
//     changeOrigin: true,
// });

const authServiceProxy = createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: (path, req) => {
      // This function ensures the '/api/v1/users' prefix is always present
    //   const originalPathWithoutPrefix = path.replace('/api/v1/users', ''); // Get the part after /api/v1/users
    //   const newPath = '/api/v1/users' + originalPathWithoutPrefix;
    const newPath = '/api/v1/users' + path;
      console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); // Log rewrite
      logger.debug(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`);
      return newPath; // Return the full path expected by the auth service
    }
});

// Proxy for the Data Service
const dataServiceProxy = createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: (path, req) => {
      // This function ensures the '/api/v1/users' prefix is always present
    //   const originalPathWithoutPrefix = path.replace('/api/v1/users', ''); // Get the part after /api/v1/users
    //   const newPath = '/api/v1/users' + originalPathWithoutPrefix;
    const newPath = '/api/v1/coins' + path;
      console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); // Log rewrite
      logger.debug(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`);
      return newPath; // Return the full path expected by the auth service
    }
});

// Proxy for the Data Service that requires authentication
const securedDataServiceProxy = createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    // logLevel: 'debug',
    pathRewrite: (path, req) => {
      // This function ensures the '/api/v1/users' prefix is always present
    //   const originalPathWithoutPrefix = path.replace('/api/v1/users', ''); // Get the part after /api/v1/users
    //   const newPath = '/api/v1/users' + originalPathWithoutPrefix;
    const newPath = '/api/v1/watchlist' + path;
      console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); // Log rewrite
      logger.debug(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`);
      return newPath; // Return the full path expected by the auth service
    },
    onProxyReq: (proxyReq, req, res) => {
        // req.user is attached by your verifyJWT middleware
        if (req.user) {
            // Add the user ID as a custom header for the downstream service
            proxyReq.setHeader('X-User-ID', req.user._id);
        }
    }
});


// --- Route Definitions ---

// Express matches routes in order. The most specific (secured) routes first.

// Secured Data Routes
app.use('/api/v1/watchlist', verifyJWT, securedDataServiceProxy);

// Secured User Account Routes
// app.use(
//     [
//         '/api/v1/users/logout',
//         '/api/v1/users/change-password',
//         '/api/v1/users/current-user',
//         '/api/v1/users/update-account',
//         '/api/v1/users/update-avatar'
//     ],
//     verifyJWT,       // Step 1: Verify the access token
//     authServiceProxy // Step 2: Proxy to the auth service
// );

// Public User Auth Routes
// Catches all other routes under /api/v1/users (login, register, refresh, google, etc.)
app.use('/api/v1/users', authServiceProxy);

// Public Coin Data Routes
app.use('/api/v1/coins', dataServiceProxy);


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    logger.error(`[Gateway Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    console.error(`[Gateway Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    
    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || []
    });
});

export default app;