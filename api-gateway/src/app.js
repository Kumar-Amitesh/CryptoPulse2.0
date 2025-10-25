import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// fixRequestBody ensures proxied requests keep a correct body (especially for non-GET methods and certain content-types).
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import verifyJWT from './middleware/auth.middleware.js';
import logger from './utils/logger.utils.js';
import userRateLimiter from './middleware/rateLimit.middleware.js';
import { RedisStore } from 'rate-limit-redis'
import { client as redisClient } from './config/redis.config.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';


dotenv.config({
    path:'../../.env' 
});

const app = express();

// Trust the first proxy in front of your app
// This is a common setting for many hosting providers.
app.set('trust proxy', 1);


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(cookieParser());
app.use(express.urlencoded({extended: true, limit: "5kb"}));
app.use(express.json());

// --- General IP-Based Rate Limiter ---
const generalLimiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    limit: 100, 
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    standardHeaders: 'draft-7', 
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // prefix if your Redis instance is shared
    keyGenerator: (req) => {
        console.log('IP Key Generator - Client IP:', ipKeyGenerator(req).ip);
        return `rate-limit-ip:${ipKeyGenerator(req).ip}`;
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args), // <-- Connect store to your client
    }), // Configure RedisStore here for distributed environments
});

app.use(generalLimiter);

// Service URLs 
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL;

if (!AUTH_SERVICE_URL || !DATA_SERVICE_URL) {
    const errorMsg = "FATAL ERROR: AUTH_SERVICE_URL or DATA_SERVICE_URL is not defined in environment variables.";
    logger.error(errorMsg);
    console.error(errorMsg);
    process.exit(1); // Exit if essential config is missing
}

// console.log(`Auth Service URL: ${AUTH_SERVICE_URL}`);
// console.log(`Data Service URL: ${DATA_SERVICE_URL}`);

// --- Helper Function for Logging ---
const logProvider = (provider) => {
    return {
        log: logger.debug.bind(logger), // Use debug level for HPM logs
        info: logger.info.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
    };
};


// --- Common Proxy Options ---
const commonProxyOptions = {
    changeOrigin: true,
    // logger:console,
    logProvider,
    on:{

        proxyReq: (proxyReq, req, res) => {
            // console.log('[HPM onProxyReq] req.user object:', req.user);
            if (req.user) {
                proxyReq.setHeader('X-User-ID', req.user._id);
                logger.debug(`[HPM Set Header] X-User-ID: ${req.user._id} for ${req.originalUrl}`);
            } else {
                logger.warn(`[HPM Set Header] No req.user found for ${req.originalUrl}`);
            }
            fixRequestBody(proxyReq, req, res, {}); 
        },

        error: (err, req, res) => { // Custom error handling
            logger.error(`[HPM Proxy Error] ${err.message}`, { url: req.originalUrl, target: err.target, code: err.code });
            console.error(`[HPM Proxy Error] ${err.message}`);
            // Avoid sending HPM's default error page
            if (!res.headersSent) {
                res.status(503).json({ // Service Unavailable
                    success: false,
                    message: 'The service is temporarily unavailable. Please try again later.'
                });
            }
        }
    }
};


// --- Create Proxy Instances ---

// Proxy for the Authentication Service
const authServiceProxy = createProxyMiddleware({
  ...commonProxyOptions,
  target: AUTH_SERVICE_URL,
  pathRewrite: (path, req) => {
    const newPath = req.originalUrl;
    console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); 
    logger.debug(
      `[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`
    );
    return newPath; // Return the full path expected by the auth service
  },
});


// Proxy for the Data Service
const dataServiceProxy = createProxyMiddleware({
  ...commonProxyOptions,
  target: DATA_SERVICE_URL,
  pathRewrite: (path, req) => {
    const newPath = req.originalUrl;
    console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); 
    logger.debug(
      `[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`
    );
    return newPath;
  },
});



// --- Route Definitions ---

// Secured Data Routes
app.use('/api/v1/watchlist', verifyJWT, userRateLimiter, dataServiceProxy);
app.use('/api/v1/portfolio', verifyJWT, userRateLimiter, dataServiceProxy);


// Secured User Account Routes
app.use(
    [
        '/api/v1/users/logout',
        '/api/v1/users/change-password',
        '/api/v1/users/current-user',
        '/api/v1/users/update-account',
        '/api/v1/users/update-avatar'
    ],
    verifyJWT,       
    authServiceProxy
);


// Public User Auth Routes
app.use('/api/v1/users', userRateLimiter, authServiceProxy);

// Public Coin Data Routes
app.use('/api/v1/coins', userRateLimiter, dataServiceProxy);

// Public Analytics Routes
app.use('/api/v1/analytics', userRateLimiter, dataServiceProxy);


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