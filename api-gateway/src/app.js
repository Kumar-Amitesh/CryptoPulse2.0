import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import verifyJWT from './middleware/auth.middleware.js';

dotenv.config({
    path:'../../.env' // Assuming .env is in the root folder
});

const app = express();


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(cookieParser());
app.use(express.urlencoded({extended: true, limit: "5kb"}));
app.use(express.json());

// Service URLs from .env file
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL;

console.log(`Auth Service URL: ${AUTH_SERVICE_URL}`);
console.log(`Data Service URL: ${DATA_SERVICE_URL}`);

// --- Create Proxy Instances ---

// Proxy for the Authentication Service
const authServiceProxy = createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
});

// Proxy for the Data Service
const dataServiceProxy = createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
});

// Proxy for the Data Service that *requires* user ID
const securedDataServiceProxy = createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        // req.user is attached by your verifyJWT middleware
        if (req.user) {
            // Add the user ID as a custom header for the downstream service
            proxyReq.setHeader('X-User-ID', req.user._id);
        }
    }
});


// --- Route Definitions ---

// Express matches routes in order. We define the most specific (secured) routes first.

// 1. Secured Data Routes
app.use('/api/v1/watchlist', verifyJWT, securedDataServiceProxy);

// 2. Secured User Account Routes
app.use(
    [
        '/api/v1/users/logout',
        '/api/v1/users/change-password',
        '/api/v1/users/current-user',
        '/api/v1/users/update-account',
        '/api/v1/users/update-avatar'
    ],
    verifyJWT,       // Step 1: Verify the access token
    authServiceProxy // Step 2: Proxy to the auth service
);

// 3. Public User Auth Routes
// Catches all other routes under /api/v1/users (login, register, refresh, google, etc.)
app.use('/api/v1/users', authServiceProxy);

// 4. Public Coin Data Routes
app.use('/api/v1/coins', dataServiceProxy);


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`[Gateway Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    
    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || []
    });
});

export default app;