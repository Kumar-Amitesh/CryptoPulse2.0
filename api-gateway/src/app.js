import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuid } from "uuid";
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';  // fixRequestBody ensures proxied requests keep a correct body (especially for non-GET methods and certain content-types).
import dotenv from 'dotenv';
import verifyJWT from './middleware/auth.middleware.js';
import logger from './utils/logger.utils.js';
import userRateLimiter from './middleware/rateLimit.middleware.js';
import { RedisStore } from 'rate-limit-redis'
import { client as redisClient } from './config/redis.config.js';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import cacheMiddleware from './middleware/cache.middleware.js';
import morgan from 'morgan';

dotenv.config({
    path:'../../.env' 
});

const app = express();

// If gateway runs behind a load balancer, add app.set('trust proxy', 1) so IP detection and secure cookies work correctly.
if (process.env.TRUST_PROXY) {
  if (process.env.TRUST_PROXY === "true") app.set("trust proxy", true);
  else if (process.env.TRUST_PROXY === "false") app.set("trust proxy", false);
  else app.set("trust proxy", Number(process.env.TRUST_PROXY));
} else {
  // default to trusting first proxy
  app.set("trust proxy", 1);
}

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '100kb' }));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '100kb' }));

// Request ID middleware (for correlation across services)
app.use((req, res, next) => {
  // Allow upstream proxy to pass an existing request id
  const existing = req.headers["x-request-id"] || req.headers["x_correlation_id"];
  req.id = existing || uuid();
  res.setHeader("X-Request-ID", req.id);
  next();
});

// Morgan setup: include req-id token and pipe to logger
morgan.token('req-id', (req) => req.id || '-');
morgan.token('remote-addr', (req) => req.ip || req.connection?.remoteAddress || '-');

const morganFormat = ':req-id :remote-addr :method :url :status :res[content-length] - :response-time ms :user-agent';

app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        if (logger && typeof logger.http === "function")
          logger.http(message.trim());
        else console.info(message.trim());
      },
    },
    skip: (req) => req.path === "/metrics", // skip noisy endpoints
  })
);

// Response logging middleware for structured request lifecycle logs
app.use((req, res, next) => {
  const start = Date.now();
  // capture end of response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const entry = {
      reqId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      contentLength: res.getHeader("Content-Length") || 0,
      user: req.user ? { id: req.user._id } : undefined,
    };
    if (res.statusCode >= 500) logger.error("request_finished", entry);
    else if (res.statusCode >= 400) logger.warn("request_finished", entry);
    else logger.info("request_finished", entry);
  });
  next();
});


// General IP-Based Rate Limiter
const generalLimiter = rateLimit({ 
    windowMs: Number(process.env.RATE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_MAX) || 100,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    standardHeaders: 'draft-7', 
	  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // prefix if Redis instance is shared
    keyGenerator: (req) => {
        console.log('IP Key Generator - Client IP:', ipKeyGenerator(req).ip);
        return `rate-limit-ip:${ipKeyGenerator(req).ip}`;
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args), // Connect store to redis client
    }), // Configure RedisStore for distributed environments
});

app.use(generalLimiter);

// Service URLs 
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL;
const GRAPHQL_SERVICE_URL = process.env.GRAPHQL_SERVICE_URL;
const WEBSOCKET_SERVICE_URL = process.env.WEBSOCKET_SERVICE_URL;

if (!AUTH_SERVICE_URL || !DATA_SERVICE_URL || !WEBSOCKET_SERVICE_URL || !GRAPHQL_SERVICE_URL) {
    const errorMsg = "FATAL ERROR: AUTH_SERVICE_URL or DATA_SERVICE_URL is not defined in environment variables.";
    logger.error(errorMsg);
    console.error(errorMsg);
    process.exit(1); 
}

// Helper Function for Logging
const logProvider = (provider) => {
    return {
        log: logger.debug.bind(logger), // Use debug level for HPM logs
        info: logger.info.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
    };
};


// Common Proxy Options
const commonProxyOptions = {
    changeOrigin: true,
    xfwd: true, // add x-forwarded-* headers
    // logger:console,
    logProvider,
    preserveHeaderKeyCase: true,
    on:{
        proxyReq: (proxyReq, req, res) => {
            if (req.id) proxyReq.setHeader('X-Request-ID', req.id);
            proxyReq.setHeader('X-User-Secret', process.env.USER_SECRET_KEY);
            if (req.user) {
                proxyReq.setHeader('X-User-ID', req.user._id);
                logger.debug(`[HPM Set Header] X-User-ID: ${req.user._id} for ${req.originalUrl}`);
            } else {
                logger.warn(`[HPM Set Header] No req.user found for ${req.originalUrl}`);
            }
            try {
              fixRequestBody(proxyReq, req, res, {});
            } catch (err) {
              logger.warn("fixRequestBody failed", {
                err: err?.message,
                path: req.originalUrl,
              });
            } 
        },

        // called when the proxy receives the response from the target
        proxyRes: (proxyRes, req, res) => {
          // capture headers, status codes here
          logger.debug('proxy_response', {
            reqId: req.id,
            url: req.originalUrl,
            targetStatus: proxyRes.statusCode,
          });
        },

        error: (err, req, res) => { // Custom error handling
            logger.error('proxy_error', { message: err?.message, reqId: req.id, url: req.originalUrl });
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


// Create Proxy Instances
const makeProxy = (target, opts = {}) => createProxyMiddleware({ ...commonProxyOptions, target, ...opts });

// Proxy for the Authentication Service
// const authServiceProxy = createProxyMiddleware({
//   ...commonProxyOptions,
//   target: AUTH_SERVICE_URL,
//   pathRewrite: (path, req) => {
//     const newPath = req.originalUrl;
//     console.log(`[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`); 
//     logger.debug(
//       `[HPM PathRewrite] Original: ${path} => Rewritten: ${newPath}`
//     );
//     return newPath; // Return the full path expected by the auth service
//   },
// });
const authServiceProxy = makeProxy(AUTH_SERVICE_URL, {
  pathRewrite: (path, req) => req.originalUrl || path,
});

// Proxy for the Data Service
const dataServiceProxy = makeProxy(DATA_SERVICE_URL, {
  pathRewrite: (path, req) => req.originalUrl || path,
});


// Proxy for the WebSocket Service (Handles HTTP polling and WS upgrades)
const websocketServiceProxy = makeProxy(WEBSOCKET_SERVICE_URL, {
  ws: true,
  pathRewrite: { "^/socket.io": "/socket.io" },
  on: {
    proxyReqWs: (proxyReq, req, socket, options, head) => {
      logger.debug("ws_upgrade", { reqId: req.id, url: req.url });
    },
    error: commonProxyOptions.on.error,
  },
});

// Proxy for the GraphQL Service
const graphqlServiceProxy = makeProxy(GRAPHQL_SERVICE_URL, {
  pathRewrite: (path, req) => req.originalUrl || path,
});

// Routes

// path '/socket.io/' is the default used by socket.io client
app.use('/socket.io/', websocketServiceProxy);

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


// Public User Auth Route
app.use('/api/v1/users', userRateLimiter, authServiceProxy);

// Public Coin Data Route
app.use('/api/v1/coins', userRateLimiter, cacheMiddleware, dataServiceProxy);

// Public Analytics Route
app.use('/api/v1/analytics', userRateLimiter, dataServiceProxy);

// Public GraphQL Route
app.use('/graphql', userRateLimiter, graphqlServiceProxy);



// Healthcheck endpoint
app.get('/healthz', (req, res) => res.json({ status: 'ok', timestamp: Date.now(), reqId: req.id }));
;

// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    // logger.error(`[Gateway Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    logger.error('unhandled_error', { statusCode, message: err.message, reqId: req?.id, stack: err.stack });
    console.error(`[Gateway Error] ${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    
    res.status(statusCode).json({
        success: false,
        message: message,
        reqId: req?.id,
        errors: err.errors || []
    });
});

export default app;
export { websocketServiceProxy };