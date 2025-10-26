import { authServiceClient, dataServiceClient, requestService } from './utils/serviceClient.graphql.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import { GraphQLScalarType, Kind } from 'graphql';

// Custom Date Scalar
const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) { // Converts backend Date object to JSON output
    if (value instanceof Date) {
      return value.toISOString();
    }
    throw Error('GraphQL Date Scalar serializer expected a `Date` object');
  },
  parseValue(value) { // Converts JSON input (string) to backend Date object
    if (typeof value === 'string') {
      return new Date(value);
    }
    throw new Error('GraphQL Date Scalar parser expected a `string`');
  },
  parseLiteral(ast) { // Converts AST input (string literal) to backend Date object
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null; // Invalid input
  },
});


const resolvers = {
  Date: dateScalar, // Register the custom scalar

  Query: {
    currentUser: async (_, __, context) => {
      // The verifyJWT middleware should place user info in context.user
      if (!context.user) {
        // return null; // Or throw an AuthenticationError
        throw new GraphQLError('User is not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      // Assuming context.user has the necessary details (_id, email, etc.)
      // We might not even need to call the auth service if JWT has enough info.
      // return await requestService(authServiceClient, 'get', '/api/v1/users/current-user', {}, context);
       return context.user; // Return user data from token/context
    },
    coins: async (_, { page }, context) => {
      return await requestService(dataServiceClient, 'get', '/api/v1/coins', { params: { page } }, context);
    },
    coin: async (_, { id }, context) => {
      return await requestService(dataServiceClient, 'get', `/api/v1/coins/${id}`, {}, context);
    },
    watchlist: async (_, __, context) => {
        // console.log(context) -> user is added before req alo in req body
        // { user:{}, req:{}, res:{} }
      if (!context.user) throw new ApiError(401, 'Authentication required');
      return await requestService(dataServiceClient, 'get', '/api/v1/watchlist', {}, context);
    },
    portfolioSummary: async (_, __, context) => {
        if (!context.user) throw new ApiError(401, 'Authentication required');
        return await requestService(dataServiceClient, 'get', '/api/v1/portfolio/summary', {}, context);
    },
     coinHistory: async (_, { coinId, interval, days }, context) => {
        return await requestService(dataServiceClient, 'get', `/api/v1/coins/history/${coinId}`, { params: { interval, days } }, context);
    },
    popularCoins: async (_, { limit }, context) => {
        return await requestService(dataServiceClient, 'get', '/api/v1/analytics/popular', { params: { limit } }, context);
    },
  },

  Mutation: {
    addToWatchlist: async (_, { coinId }, context) => {
        if (!context.user) throw new ApiError(401, 'Authentication required');
        // The service returns the created watchlist item, which matches the schema type
        return await requestService(dataServiceClient, 'post', '/api/v1/watchlist', { data: { coinId } }, context);
    },
    removeFromWatchlist: async (_, { coinId }, context) => {
      if (!context.user) throw new ApiError(401, 'Authentication required');
        try {
            // Service returns {} on success, we need to return boolean
             await requestService(dataServiceClient, 'delete', `/api/v1/watchlist/${coinId}`, {}, context);
            return true; // Indicate success
        } catch (error) {
             console.error("Error removing from watchlist:", error);
             // Optionally check error type (e.g., 404 means already removed)
            if (error.statusCode === 404) {
                return false; // Or maybe true if idempotent is desired
            }
             return false; // Indicate failure
        }
    },
    addTransaction: async (_, { coinId, type, quantity, pricePerCoin, transactionDate }, context) => {
        if (!context.user) throw new ApiError(401, 'Authentication required');
        const payload = { coinId, type, quantity, pricePerCoin };
        if (transactionDate) {
            payload.transactionDate = transactionDate; // Pass it along if provided
        }
        // Service returns the created transaction
        return await requestService(dataServiceClient, 'post', '/api/v1/portfolio/transactions', { data: payload }, context);
    },

    // --- Authentication Mutations (Example - Keep as REST recommended) ---
    // login: async (_, { emailOrUsername, password }) => {
    //   // Complex: Need to call auth service, then potentially set cookies in the gateway response
    //   // This is hard to do cleanly via GraphQL resolvers alone.
    //   // Placeholder - implementation would require careful handling of response headers/cookies
    //   console.warn("Login mutation called - REST endpoint is generally preferred for auth.");
    //   // const response = await requestService(authServiceClient, 'post', '/api/v1/users/login', { data: { emailOrUsername, password }});
    //   // How to set cookies here? Apollo context modification needed.
    //   return null; // Placeholder
    // },
    // logout: async (_, __, context) => {
    //    console.warn("Logout mutation called - REST endpoint is generally preferred for auth.");
    //    // Needs to call auth service AND clear cookies in gateway response.
    //    // await requestService(authServiceClient, 'get', '/api/v1/users/logout', {}, context);
    //    // How to clear cookies here?
    //    return false; // Placeholder
    // }

  },

  // Resolver for nested fields (if needed)
  WatchlistItem: {
     // If WatchlistItem type had a 'coin: Coin' field
     coin: async (parent, _, context) => {
         // parent contains the WatchlistItem ({ _id, user, coinId, ... })
         return await requestService(dataServiceClient, 'get', `/api/v1/coins/${parent.coinId}`, {}, context);
     }
  },
  Transaction: {
     // If Transaction type had a 'coin: Coin' field
     coin: async (parent, _, context) => {
         return await requestService(dataServiceClient, 'get', `/api/v1/coins/${parent.coinId}`, {}, context);
     }
  }


  // Add resolvers for other nested fields if defined in schema (e.g., User within Transaction)
};

export default resolvers;
