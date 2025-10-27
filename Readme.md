# CryptoPulse

## Description

CryptoPulse 2.0 is a comprehensive cryptocurrency tracking and portfolio management application built with a microservices architecture. It allows users to register, log in (including Google OAuth), view real-time cryptocurrency data, manage their watchlist and portfolio, and view analytics like popular coins.

## Architecture

The application follows a microservices pattern, separating concerns into distinct services:

1.  **API Gateway (`api-gateway`):** The single entry point for all client requests. It handles routing, authentication (JWT verification), rate limiting, and exposes a GraphQL API aggregating data from other services.
2.  **Authentication Service (`auth-service`):** Manages user registration, login (email/password and Google OAuth), JWT generation/refresh, password changes, and user profile updates.
3.  **Data Service (`data-service`):** Handles fetching and serving cryptocurrency data (listings, details, history), managing user watchlists, portfolio transactions, and providing analytics (e.g., popular coins).
4.  **Worker Service (`worker-service`):** Processes background jobs, primarily fetching cryptocurrency data from external APIs (like CoinGecko) using BullMQ queues, caching it in Redis, and saving historical snapshots.
5.  **Scheduler Service (`scheduler-service`):** Schedules repeatable jobs (using BullMQ) to trigger data updates in the Worker Service (e.g., fetching top coins, updating watchlist coins).
6.  **WebSocket Service (`websocket-service`):** Provides real-time updates to connected clients (e.g., live price changes) using Socket.IO and Redis pub/sub.

## Features

* **User Authentication:**
    * Register with email, username, password, and avatar.
    * Login with email/username and password.
    * Google OAuth 2.0 for registration and login.
    * Secure JWT-based authentication (access and refresh tokens).
    * Password change functionality.
    * Update user account details and avatar.
* **Cryptocurrency Data:**
    * View paginated lists of cryptocurrencies.
    * View detailed information for specific coins.
    * View historical price data (hourly, daily) for coins.
    * Real-time price updates via WebSockets.
* **Watchlist:**
    * Add coins to a personal watchlist.
    * View all coins on the watchlist.
    * Remove coins from the watchlist.
* **Portfolio Management:**
    * Add buy/sell transactions for cryptocurrencies.
    * View a summary of portfolio holdings, including quantity, cost basis, current value, profit/loss.
* **Analytics:**
    * View popular coins based on user watchlist counts.
* **Background Processing:**
    * Regularly updates top cryptocurrency data.
    * Regularly updates data for coins present in user watchlists.
    * Saves historical price snapshots.
* **API & Gateway:**
    * Centralized API Gateway for routing requests.
    * GraphQL API for flexible data querying.
    * Rate limiting (IP-based and user-based).

## Technology Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB (with Mongoose ODM)
* **Caching/Messaging:** Redis
* **Job Queue:** BullMQ
* **Real-time Communication:** Socket.IO (with Redis Adapter)
* **API Gateway:** Express.js, `http-proxy-middleware`
* **GraphQL:** Apollo Server (@apollo/server)
* **Authentication:** JWT (jsonwebtoken), bcrypt
* **File Uploads:** Multer, Cloudinary
* **Other:** dotenv, Winston (logging), Axios (HTTP client), Opossum (circuit breaker), express-validator

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd CryptoPulse2.0
    ```

2.  **Environment Variables:**
    * Create a `.env` file in the root directory (`CryptoPulse2.0/`).
    * Populate it with necessary environment variables based on the code (check `config/*.config.js` files and `.env` usage):
        * `PORT` (for API Gateway, e.g., 3000)
        * `MONGO_URI` (MongoDB connection string)
        * `DB_NAME` (e.g., CryptoPulse)
        * `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`
        * `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
        * `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`
        * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
        * `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
        * `CoinGecko_URL_COIN`, `CoinGecko_API_KEY`
        * `CORS_ORIGIN`
        * Service URLs (if running locally):
            * `AUTH_SERVICE_URL` (e.g., http://localhost:8001)
            * `DATA_SERVICE_URL` (e.g., http://localhost:8002)
            * `WEBSOCKET_SERVICE_URL` (e.g., http://localhost:8004)

3.  **Install Dependencies:**
    Navigate into each service directory (`api-gateway`, `auth-service`, `data-service`, `worker-service`, `scheduler-service`, `websocket-service`) and run:
    ```bash
    npm install
    ```

4.  **Run Services:**
    Start each service. Open separate terminals for each service:
    ```bash
    # Terminal 1: API Gateway
    cd api-gateway
    node src/index.js

    # Terminal 2: Auth Service
    cd ../auth-service
    node src/index.js

    # Terminal 3: Data Service
    cd ../data-service
    node src/index.js

    # Terminal 4: Worker Service
    cd ../worker-service
    node src/index.js

    # Terminal 5: Scheduler Service
    cd ../scheduler-service
    node src/index.js

    # Terminal 6: WebSocket Service
    cd ../websocket-service
    node src/index.js
    ```

5.  **Access the Application:**
    * The API Gateway runs on the port specified by `PORT` in your `.env`.
    * The GraphQL endpoint is available at `http://localhost:<PORT>/graphql`.
    * REST endpoints are available under `/api/v1/...`.

## Services Breakdown

* **`api-gateway`:** Routes client requests (REST & GraphQL) to appropriate downstream services, handles authentication checks and rate limiting.
* **`auth-service`:** Handles all user identity and authentication logic.
* **`data-service`:** Core service for managing cryptocurrency data, user watchlists, and portfolios. Interacts heavily with MongoDB and Redis.
* **`worker-service`:** Listens for jobs from BullMQ (scheduled by `scheduler-service`), fetches data from external APIs (CoinGecko), performs data processing, updates the Redis cache, and saves historical data to MongoDB. Includes retry and circuit breaker patterns for external API calls.
* **`scheduler-service`:** Uses BullMQ to schedule recurring tasks (like updating coin data) that are picked up by the `worker-service`.
* **`websocket-service`:** Manages WebSocket connections, authenticates users, and pushes real-time data updates received via Redis pub/sub from the `worker-service`.

## Logging

Each service utilizes Winston for logging. Logs are typically stored in a `logs` directory relative to the service's root (e.g., `api-gateway/logs/`). Log levels include error, warn, http, and combined.