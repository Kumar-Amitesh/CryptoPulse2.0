import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.utils.js';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';

import typeDefs from './schema.graphql.js';
import resolvers from './resolvers.graphql.js';

import User from './models/Users.models.js';

dotenv.config({
    path:'../../.env' 
});

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json());

// --- Apollo Server Setup ---
const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
});

async function startApolloServer() {
    try {
        await apolloServer.start();
        logger.info('Apollo Server started successfully.');

        app.use(
            '/graphql',
            express.json(), 
            expressMiddleware(apolloServer, {
                context: async ({ req, res }) => {
                    const userId = req.header('X-User-ID');
                    const userSecret = req.header('X-User-Secret');

                    const user = await User.findById(userId);

                    // Authenticate user context via headers forwarded by the API Gateway
                    if (userId && userSecret === process.env.USER_SECRET_KEY) {
                        return {
                            // User object simplified to hold just the ID for downstream requests
                            user: user, 
                            req,
                            res
                        };
                    } 
                    // Unauthenticated context for public queries
                    return { user: null, req, res };
                },
            }),
        );
        console.log('Apollo Server /graphql endpoint is set up.');
    } catch (err) {
        logger.error('Error starting Apollo Server:', err);
        console.error('Error starting Apollo Server:', err);
        throw err;
    }
}

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { stack: err.stack, statusCode: err.statusCode });
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal GraphQL Server Error';
    
    res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || []
    });
});


await startApolloServer();

export default app;