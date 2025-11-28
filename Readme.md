# CryptoPulse

## Description

CryptoPulse is a comprehensive cryptocurrency tracking and portfolio management application built with a microservices architecture. It allows users to register, log in (including Google OAuth), view real-time cryptocurrency data, manage their watchlist and portfolio, and view analytics like popular coins.

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
  * **Other:** dotenv, Winston (logging), Morgan (HTTP logging), Axios (HTTP client), Opossum (circuit breaker), express-validator

## Design Concepts & Performance

This architecture was chosen to support scalability, resilience, and maintainability.

### Horizontal Scalability & Load Balancing

The application is designed to be scaled horizontally. By using `docker-compose up --scale <service-name>=N`, multiple instances of any service can be run. For example, in the test command, the `api-gateway` was scaled to 2 instances and the `data-service` to 3. Docker's built-in networking provides round-robin load balancing, distributing incoming requests across the available container instances for a given service.

### Asynchronous Processing (Job Queues)

To prevent long-running tasks (like fetching data from external APIs) from blocking the main request/response cycle, the system uses a job queue.

  * The **Scheduler Service** uses BullMQ to add repeatable jobs, such as `JOB_UPDATE_TOP_COINS` (every 2 minutes) and `JOB_UPDATE_WATCHLIST` (every 5 minutes), to a Redis-backed queue.
  * The **Worker Service** (scaled to 4 instances in the test) listens for and processes these jobs, fetching data and updating the cache/database in the background.

### Resilience (Retry & Circuit Breaker)

The `worker-service` communicates with the external CoinGecko API, which could be unreliable. To handle this, it implements:

  * **Retry Logic:** Using `axios-retry`, failed requests (due to network errors or 429 rate limits) are automatically retried 3 times with exponential backoff.
  * **Circuit Breaker:** Using `opossum`, if the API failure rate exceeds 50%, the circuit "opens" for 30 seconds. This stops the worker from hammering the failing API and allows it to recover, preventing cascading failures.

### Microservice Security

Internal communication between the API Gateway and downstream services (like the Data Service) is secured using a **Shared Secret** mechanism. The Gateway injects a custom header `X-User-Secret` (validated against `USER_SECRET_KEY`) into proxied requests. This ensures that downstream services reject direct external requests that bypass the Gateway.

### Rate Limiting (Demonstrated by Load Test)

The `api-gateway` protects the application from abuse using rate limiters.

  * A **General IP Limiter** applies to all requests (100 requests / 15 minutes).
  * A **User-Based Limiter** applies to specific routes (100 requests / 60 seconds for a 'free' plan).

This is demonstrated by the provided load test results for the unauthenticated `/api/v1/coins` endpoint, which is subject to the IP-based limiter:

**Test 1: High Concurrency (n=100, c=50)**
  * **Command:** `docker-compose run --rm load-tester -n 100 -c 50 "http://api-gateway:3000/api/v1/coins"`
  * **Result:** All 100 requests were successful (`[200] 100 responses`).
  * **Analysis:** The system successfully handled a burst of 100 requests from 50 concurrent users. The average latency was ~0.24s, demonstrating good performance under load within the rate limit.

**Test 2: Rate Limit Test (n=200, c=50)**
  * **Command:** `docker-compose run --rm load-tester -n 200 -c 50 "http://api-gateway:3000/api/v1/coins"`
  * **Result:** The test received 100 successful responses (`[200] 100 responses`) and 100 rejected responses (`[429] 100 responses`).
  * **Analysis:** This test clearly demonstrates the IP-based rate limiter (100 requests / 15 minutes) in action. The first 100 requests were processed successfully, after which the gateway correctly rejected the subsequent 100 requests with a `429 Too Many Requests` status, protecting the downstream services from the excessive load. The rejections were handled very quickly, as shown by the high overall requests/sec (349.97).

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
          * `USER_SECRET_KEY` (Shared secret for inter-service communication security)
          * Service URLs (if running locally):
              * `AUTH_SERVICE_URL` (e.g., http://localhost:8001)
              * `DATA_SERVICE_URL` (e.g., http://localhost:8002)
              * `GRAPHQL_SERVICE_URL` (e.g., http://localhost:8003)
              * `WEBSOCKET_SERVICE_URL` (e.g., http://localhost:8004)

3.  **Install Dependencies:**
    Navigate into each service directory (`api-gateway`, `auth-service`, `data-service`, `worker-service`, `scheduler-service`, `websocket-service`) and run:

    ```bash
    npm install
    ```

4.  **Run Services (Manual):**
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

5.  **Run Services (Docker Compose):**
    Alternatively, you can build and run the entire application stack using Docker Compose from the root directory (`CryptoPulse2.0/`).

      * **Build and Run (with scaling):**
        Build and run all services in detached mode, scaling them as desired. The following command matches your test configuration:

        **Note on Docker Volumes:** The `docker-compose.yml` file currently contains a hardcoded absolute path for the Redis volume. Before running `docker-compose up`, please update the volume path under the `redis` service to match your local file system or use a named volume.

        ```bash
        docker-compose up -d --build --scale api-gateway=2 --scale auth-service=2 --scale data-service=3 --scale worker-service=4 --scale scheduler-service=1 --scale websocket-service=2
        ```

      * **Load Testing:**
        The `docker-compose.yml` includes a `load-tester` service (using `yamaszone/hey`). You can run it to send traffic to the `api-gateway`.

        **Test (High Load): 100 requests, 50 concurrent**

        ```bash
        docker-compose run --rm load-tester -n 100 -c 50 "http://api-gateway:3000/api/v1/coins"
        ```

        **Test (Rate Limit Test): 200 requests, 50 concurrent**

        ```bash
        docker-compose run --rm load-tester -n 200 -c 50 "http://api-gateway:3000/api/v1/coins"
        ```

6.  **Access the Application:**

      * The API Gateway runs on the port specified by `PORT` in your `.env` (e.g., `http://localhost:3000`).
      * The GraphQL endpoint is available at `http://localhost:<PORT>/graphql`.
      * **GraphQL Playground:** You can explore the data graph and run queries interactively at `http://localhost:<PORT>/graphql` (via the Gateway).
      * REST endpoints are available under `/api/v1/...`.

## Services Breakdown

  * **`api-gateway`:** Routes client requests (REST & GraphQL) to appropriate downstream services, handles authentication checks and rate limiting.
  * **`auth-service`:** Handles all user identity and authentication logic.
  * **`data-service`:** Core service for managing cryptocurrency data, user watchlists, and portfolios. Interacts heavily with MongoDB and Redis.
  * **`worker-service`:** Listens for jobs from BullMQ (scheduled by `scheduler-service`), fetches data from external APIs (CoinGecko), performs data processing, updates the Redis cache, and saves historical data to MongoDB. Includes retry and circuit breaker patterns for external API calls.
  * **`scheduler-service`:** Uses BullMQ to schedule recurring tasks (like updating coin data) that are picked up by the `worker-service`.
  * **`websocket-service`:** Manages WebSocket connections, authenticates users, and pushes real-time data updates received via Redis pub/sub from the `worker-service`.

## WebSocket API

The WebSocket service runs on port `8004` (or via the gateway at `/socket.io/`).

* **Connection:** Requires a valid JWT token passed in the handshake auth: `{ token: "YOUR_ACCESS_TOKEN" }`.
* **Events:**
    * `coinUpdate`: Listen for this event to receive real-time price updates.
        * **Payload:** `{ coinId: 'bitcoin', data: { ...coinDetails } }`
    * `subscribeToCoin`: Emit this event with a `coinId` to request specific updates (currently implemented as a basic logger in the backend).

## API Documentation

A Postman collection is included in the repository (`CryptoPulse.postman_collection.json`) containing pre-configured requests for Authentication, Portfolio management, and Coin data endpoints. Import this into Postman to test the REST API immediately.

## Logging

Each service utilizes Winston for logging. Logs are typically stored in a `logs` directory relative to the service's root (e.g., `api-gateway/logs/`). Log levels include error, warn, http, and combined.