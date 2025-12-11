# CryptoPulse

CryptoPulse is a comprehensive **cryptocurrency tracking and portfolio management** application built using a **microservices architecture**. It allows users to:

- Register and log in (email/password + Google OAuth 2.0)
- View real-time cryptocurrency data
- Manage a personal watchlist and portfolio
- View analytics (e.g., popular coins)
- Consume data via both REST and GraphQL
- Receive live updates via WebSockets
- Trace requests end-to-end using a UUID-based request ID propagated across all services

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)  
2. [Key Features](#key-features)  
3. [Technology Stack](#technology-stack)  
4. [Repository / Project Structure](#repository--project-structure)  
5. [Service-by-Service Breakdown](#service-by-service-breakdown)  
6. [Design Concepts & Performance](#design-concepts--performance)  
   - [Horizontal Scalability & Load Balancing](#horizontal-scalability--load-balancing)  
   - [Asynchronous Processing (Job Queues)](#asynchronous-processing-job-queues)  
   - [Efficient Search with Trie](#efficient-search-with-trie)  
   - [Custom Response Caching](#custom-response-caching-gateway-level)  
   - [Resilience: Retry & Circuit Breaker](#resilience-retry--circuit-breaker)  
   - [Microservice Security](#microservice-security)  
   - [Rate Limiting](#rate-limiting-demonstrated-by-load-test)  
   - [Request Tracing with UUID](#request-tracing-with-uuid-correlation-ids)  
7. [APIs](#apis)  
   - [REST API – Endpoint Summary](#rest-api--endpoint-summary)  
   - [GraphQL API](#graphql-api)  
   - [WebSocket API](#websocket-api)  
8. [CI/CD Pipeline Simulation](#cicd-pipeline-simulation)  
9. [Setup & Installation](#setup--installation)  
10. [Running the Services](#running-the-services)  
11. [Testing](#testing)  
12. [Logging](#logging)  
13. [Future Improvements](#future-improvements)

---

## Architecture Overview

CryptoPulse follows a **microservices architecture**, with a dedicated service for each concern:

1. **API Gateway (`api-gateway`)**  
   Single entry point for all client traffic. Handles:
   - Routing & proxying to downstream services
   - Authentication (JWT verification)
   - Rate limiting (IP-based and user-based)
   - Gateway-level caching
   - Generation and propagation of a UUID-based request ID for tracing
   - Exposes REST and GraphQL endpoints

2. **Authentication Service (`auth-service`)**  
   Handles:
   - User registration & login (email/password)
   - Google OAuth 2.0 (sign-in/sign-up)
   - JWT access & refresh token generation
   - Password changes
   - Profile and avatar updates

3. **Data Service (`data-service`)**  
   Core application logic for:
   - Cryptocurrency listings, details, and history
   - User watchlists
   - Portfolio transactions & summary calculations
   - Analytics (e.g., popular coins)
   - High-performance search using a **Trie** data structure

4. **Worker Service (`worker-service`)**  
   Background worker that:
   - Consumes jobs from Redis-backed BullMQ queues
   - Fetches cryptocurrency data from external APIs (e.g., CoinGecko)
   - Updates Redis cache
   - Persists historical snapshots to MongoDB
   - Uses retry + circuit breaker patterns to handle flaky external APIs

5. **Scheduler Service (`scheduler-service`)**  
   Schedules recurring jobs (via BullMQ) such as:
   - `JOB_UPDATE_TOP_COINS` – fetch top coins every 2 minutes
   - `JOB_UPDATE_WATCHLIST` – update watchlist coins every 5 minutes

6. **WebSocket Service (`websocket-service`)**  
   Manages:
   - Socket.IO connections
   - JWT-based authentication at handshake
   - Subscriptions and real-time coin updates via Redis pub/sub

7. **GraphQL Service (`graphql-service`)**  
   Provides a **GraphQL API** for:
   - Aggregated queries (e.g., portfolio summary + coin history)
   - Fetching exactly the data the client needs (no over/under-fetching)

---

## Key Features

### User Authentication

- Register using:
  - Email
  - Username
  - Password
  - Avatar (uploaded via Multer + Cloudinary)
- Login using:
  - Email/username + password
  - Google OAuth 2.0
- Logout (Token Revocation)
  - Secure logout endpoint that removes the stored refresh token from the database, preventing further token refresh attempts and fully invalidating user sessions.
- JWT-based auth:
  - Access token + refresh token
- Account management:
  - Change password
  - Update user profile & avatar

### Cryptocurrency Data

- Paginated list of cryptocurrencies
- Detailed coin view (name, symbol, price, market cap, etc.)
- Historical price data (hourly, daily)
- Real-time price updates (WebSockets)
- **Fast search** using an in-memory Trie for coin names/symbols

### Watchlist

- Add coins to personal watchlist
- View all watched coins
- Remove coins from watchlist

### Portfolio Management

- All buy/sell transactions are simulated for portfolio tracking purposes only, no actual payment or real money transaction is performed.

- Track:
  - Quantity held
  - Cost basis
  - Current value
  - Unrealized profit/loss
- Portfolio summary view

### Analytics

- Popular coins based on watchlist counts or user activity

### Background Processing

- Periodic refresh of:
  - Top coins
  - Coins present in user watchlists
- Historical price snapshots persisted for analytics and charts

### APIs & Gateway

- Centralized API Gateway for:
  - Routing
  - Authentication
  - Rate limiting
  - Gateway-level response caching
  - Attaching a unique UUID request ID to each incoming request

- REST endpoints under `/api/v1/...`
- GraphQL endpoint at `/graphql` for advanced data querying

---

## Technology Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (Mongoose ODM)  
- **Caching / Messaging:** Redis  
- **Job Queue:** BullMQ  
- **Real-time:** Socket.IO (with Redis Adapter)  
- **API Gateway:** Express.js + `http-proxy-middleware` + `express-rate-limit`  
- **GraphQL:** Apollo Server (`@apollo/server`)  
- **Auth & Security:** JWT (`jsonwebtoken`), `bcrypt`, `helmet`, `express-validator`, CORS  
- **File Uploads:** Multer, Cloudinary  
- **Resilience:** Axios, `axios-retry`, Opossum (circuit breaker)  
- **DevOps / Tooling:** Docker, Docker Compose, Bash scripts, Husky (pre-commit / pre-push / post-commit hooks)  
- **Logging & Tracing:** Winston, Morgan, UUID-based request IDs

---

## Repository / Project Structure

```bash
CryptoPulse2.0/
├── api-gateway/           # Entry point, routing, caching, rate limiting, proxy logic
├── auth-service/          # User identity, JWT management, Google OAuth
├── data-service/          # Coin data, Trie search, Watchlist & Portfolio logic
├── worker-service/        # Background jobs (BullMQ), external API fetching, snapshots
├── scheduler-service/     # Job scheduling (cron-like repeatable jobs)
├── websocket-service/     # WebSocket server (Socket.IO + Redis pub/sub)
├── graphql-service/       # GraphQL schema & resolvers
├── CryptoPulse.postman_collection.json  # API collection for Postman
├── docker-compose.yml     # Container orchestration for local dev & load tests
├── deploy.sh              # Blue-Green deployment script
├── ci-pre-commit-check.sh # Pre-commit CI checks (tests, lint, etc.)
├── ci-pre-push-check.sh   # Pre-push CI checks
├── cicd-check.sh          # Top-level CI/CD trigger script
└── README.md              # Project documentation (this file)
````

> **Note:** The `docker-compose.yml` contains a hardcoded path for the Redis volume.
> Update it to match your local filesystem or replace it with a named volume before running Docker.

---

## Service-by-Service Breakdown

### `api-gateway`

* Exposes REST & GraphQL endpoints to clients
* Verifies JWT access tokens for protected routes
* Adds `X-User-Secret` header for inter-service authentication
* Performs request-level **rate limiting** (IP-based & user-based)
* Implements **gateway-level response caching** via Redis
* **Generates a UUID for each incoming request and attaches it as `X-Request-Id`**, then propagates it to all downstream services so they can log and trace the same request end-to-end.
* Proxies requests to:

  * `auth-service`
  * `data-service`
  * `graphql-service`
  * `websocket-service`

---

### `auth-service`

* User model (MongoDB) with secure password hashing (bcrypt)
* APIs for:

  * Register
  * Login
  * Logout
  * Google OAuth
  * Refresh tokens
  * Change password
  * Update profile/avatar
* Uses `helmet` and input validation with `express-validator`
---

### `data-service`

* Responsible for **all crypto and user portfolio data**:

  * Coin listing
  * Coin details & history
  * Watchlist operations
  * Portfolio transactions & summary calculations
  * Popular coins analytics
* Implements a **Trie** for fast in-memory search over:

  * Coin names
  * Coin symbols
* Works closely with Redis for caching:

  * On write: persists to MongoDB and writes to Redis
  * Gateway reads from Redis for faster responses

---

### `worker-service`

* Subscribes to BullMQ queues populated by `scheduler-service`
* Fetches data from external APIs (e.g., CoinGecko):

  * Top coins
  * Watchlist-related coins
* Uses:

  * `axios-retry` for automatic retries with exponential backoff
  * `opossum` for circuit breaking
* Updates Redis cache and stores historical snapshots in MongoDB

---

### `scheduler-service`

* Schedules recurring jobs in BullMQ queues:

  * `JOB_UPDATE_TOP_COINS` – every 2 minutes
  * `JOB_UPDATE_WATCHLIST` – every 5 minutes
* Completely decouples **when** jobs run from **how** they’re processed

---

### `websocket-service`

* Socket.IO server on port (e.g.) `8004` or via gateway `/socket.io/`
* Authenticates clients using JWT sent in `handshake.auth`
* Subscribes to Redis pub/sub messages from `worker-service`
* Emits events like:

  * `coinUpdate` – real-time price updates to subscribed clients

---

### `graphql-service`

* Runs Apollo Server for GraphQL
* Exposes a **unified schema** combining data from multiple models:

  * `currentUser`
  * `coins`
  * `coin(id)`
  * `portfolioSummary`
  * `coinHistory`
  * `popularCoins`
* Supports mutations for:

  * `addToWatchlist`, `removeFromWatchlist`
  * `addTransaction` (buy/sell)

---

## Design Concepts & Performance

### Horizontal Scalability & Load Balancing

* All services are containerized and run via Docker Compose.
* Horizontal scaling using:

```bash
docker-compose up -d --build \
  --scale api-gateway=2 \
  --scale auth-service=2 \
  --scale data-service=3 \
  --scale worker-service=4 \
  --scale scheduler-service=1 \
  --scale websocket-service=2 \
  --scale graphql-service=1
```

* Docker’s internal DNS provides **round-robin load balancing**:

  * Example: multiple `api-gateway` or `data-service` instances share load

---

### Asynchronous Processing (Job Queues)

To keep the main HTTP request/response cycle **fast** and **non-blocking**:

* Regular and heavy operations (e.g., fetching from CoinGecko) are delegated to:

  * **Queues** (BullMQ + Redis) for job scheduling
  * **Workers** (`worker-service`) for processing
* This allows the main services (`api-gateway`, `data-service`) to remain responsive under load.

---

### Efficient Search with Trie

The `data-service` uses an in-memory **Trie** (prefix tree) for coin search:

* **Why Trie?**

  * Database-level regex search on large collections is slow.
  * A Trie allows:

    * Insert: `O(L)`
    * Search: `O(L)`
      where `L` is the query length.
* **Use Case:**

  * As users type (“Bit”), the Trie can quickly suggest:

    * “Bitcoin”
    * “BitTorrent”
    * “BitCash”
* This drastically improves the perceived search speed on the client.

---

### Custom Response Caching (Gateway-Level)

A custom caching strategy is implemented using Redis:

1. **Service Side (Write):**

   * `data-service` handles requests and writes results to Redis with a TTL.
2. **Gateway Side (Read):**

   * `api-gateway` runs a custom middleware:

     * Checks Redis for a key corresponding to the incoming request (e.g., URL + query).
     * If found, returns cached response immediately.
     * Otherwise, proxies the request downstream and caches the result.

**Performance:**
Load tests show response times dropping from **~50ms** to around **~1.5ms** for frequently accessed endpoints (like coin lists).

---

### Resilience (Retry & Circuit Breaker)

**External dependency:** CoinGecko (or similar) can be slow or rate-limited.

* **Retry Logic (`axios-retry`):**

  * Automatically retries failed requests up to 3 times.
  * Uses exponential backoff to avoid hitting the API too aggressively.
* **Circuit Breaker (`opossum`):**

  * Monitors success/failure rates.
  * If failure rate exceeds threshold (e.g., 50%), the circuit “opens”:

    * Temporarily stops calling the external API for ~30 seconds.
    * Prevents cascading failures and unnecessary load on the external service.

---

### Microservice Security

Security is enforced both at the **edge** and **internally**:

1. **JWT-Based Authentication:**

   * Access tokens for API calls.
   * Refresh tokens for obtaining new access tokens without re-login.

2. **Inter-Service Shared Secret:**

   * Gateway injects `X-User-Secret: <USER_SECRET_KEY>` into internal requests.
   * Downstream services validate this header:

     * Reject any direct external call that doesn’t originate from the gateway.

3. **Security Headers:**

   * `helmet` middleware is used to set headers like:

     * `X-Frame-Options`
     * `X-Content-Type-Options`
     * `X-XSS-Protection`, etc.

4. **CORS:**

   * Only trusted frontend origins are allowed via `CORS_ORIGIN`.

5. **Input Validation & Sanitization:**

   * `express-validator` used to:

     * Validate request bodies
     * Sanitize inputs
   * Helps prevent common injection and malformed input attacks.

---

### Rate Limiting (Demonstrated by Load Test)

The `api-gateway` uses **Redis-backed** rate limiting:

* **General IP-based limiter:**

  * 100 requests per 15 minutes per IP.
* **User-based limiter:**

  * 100 requests per 60 seconds for “free” tier users on certain routes.

#### Load Test Results

Performed using `yamaszone/hey` via Docker:

**Test 1: High Concurrency (Within Limits)**

```bash
docker-compose run --rm load-tester \
  -n 100 -c 50 "http://api-gateway:3000/api/v1/coins"
```

* **Result:**

  * `[200] 100 responses`
* **Analysis:**

  * System successfully handled the burst.
  * Average latency ~0.24s.

---

**Test 2: Rate Limit Test (Exceeding Limits)**

```bash
docker-compose run --rm load-tester \
  -n 200 -c 50 "http://api-gateway:3000/api/v1/coins"
```

* **Result:**

  * `[200] 100 responses`
  * `[429] 100 responses`
* **Analysis:**

  * First 100 requests passed.
  * Next 100 correctly throttled with `429 Too Many Requests`.
  * High requests/sec show that rejections are very fast, protecting downstream services.

---

### Request Tracing with UUID (Correlation IDs)

To make debugging and observability easier in a distributed system, **every incoming request is tagged with a unique ID**:

* The **API Gateway**:

  * Generates a `UUID` (e.g., using `uuid.v4()`).
  * Attaches it to the request as a header (e.g., `X-Request-Id`).
  * Logs it along with the HTTP method, path, and status code.

* All **downstream services**:

  * Read the `X-Request-Id` header.
  * Include it in all log entries associated with that request.
  * When making outbound HTTP calls (to other internal services), they forward the same request ID header.

**Benefit:**

* For any incident or error, you can:

  * Grab the `X-Request-Id` from a client log or error response.
  * Search that ID across **all service logs** (gateway, auth, data, worker, etc.).
  * Reconstruct the entire path of that request through the system.
* This is a simplified but powerful form of **distributed tracing** suitable for small-to-medium systems without full-blown tracing infrastructure.

---

## APIs

### REST API – Endpoint Summary

> All endpoints are accessed through the **API Gateway**.

| Category      | Method | Endpoint                          | Description                                   | Auth Required |
| ------------- | ------ | --------------------------------- | --------------------------------------------- | ------------- |
| **Auth**      | POST   | `/api/v1/users/register`          | Register a new user                           | No            |
|               | POST   | `/api/v1/users/login`             | Login with email/username + password          | No            |
|               | GET   | `/api/v1/users/google`   | Login/Register via Google OAuth               | No            |
|               | POST   | `/api/v1/users/refresh-token`     | Refresh access token                          | Yes (refresh) |
|               | GET   | `/api/v1/users/logout`            | Logout user by removing refresh token from DB    | Yes           |
|               | PATCH  | `/api/v1/users/change-password`   | Change password                               | Yes           |
|               | PATCH  | `/api/v1/users/profile`           | Update profile & avatar                       | Yes           |
| **Coins**     | GET    | `/api/v1/coins`                   | Get paginated list of coins (cached)          | No            |
|               | GET    | `/api/v1/coins/:id`               | Get single coin details                       | No            |
|               | GET    | `/api/v1/coins/history/:id`       | Historical price data                         | No            |
|               | GET    | `/api/v1/coins/search?query=...`  | Trie-based search for coins                   | No            |
| **Watchlist** | GET    | `/api/v1/watchlist`               | Get current user’s watchlist                  | Yes           |
|               | POST   | `/api/v1/watchlist`               | Add coin to watchlist                         | Yes           |
|               | DELETE | `/api/v1/watchlist/:coinId`       | Remove coin from watchlist                    | Yes           |
| **Portfolio** | GET    | `/api/v1/portfolio`               | Get portfolio holdings & summary              | Yes           |
|               | POST   | `/api/v1/portfolio/transaction`   | Add a simulated buy/sell transaction                      | Yes           |
| **Analytics** | GET    | `/api/v1/analytics/popular-coins` | Popular coins based on watchlists             | No / Yes*     |
| **GraphQL**   | POST   | `/graphql`                        | GraphQL endpoint (proxied to graphql-service) | Yes*          |

---

### GraphQL API

GraphQL endpoint (via Gateway):
`POST http://localhost:<PORT>/graphql`

#### Example Schema (Conceptual)

* **Queries**

  * `currentUser: User`
  * `coins(page: Int, limit: Int): CoinPage`
  * `coin(id: String!): Coin`
  * `portfolioSummary: PortfolioSummary`
  * `coinHistory(id: String!, range: String): [PricePoint]`
  * `popularCoins(limit: Int): [Coin]`

* **Mutations**

  * `addToWatchlist(coinId: String!): WatchlistResponse`
  * `removeFromWatchlist(coinId: String!): WatchlistResponse`
  * `addTransaction(input: TransactionInput!): Transaction`

#### Example Query

```graphql
query PortfolioWithHistory {
  currentUser {
    username
    email
  }
  portfolioSummary {
    totalValue
    totalCost
    unrealizedPL
    holdings {
      coinId
      quantity
      currentPrice
      value
    }
  }
  coinHistory(id: "bitcoin", range: "7d") {
    timestamp
    price
  }
}
```

---

### WebSocket API

WebSocket service is available via:

* Via Gateway: `ws://localhost:<PORT>/socket.io/`

#### Connection

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  path: "/socket.io/",
  auth: {
    token: "YOUR_ACCESS_TOKEN",
  },
});
```

#### Events

* **Server → Client: `coinUpdate`**

  * Payload:

    ```json
    {
      "coinId": "bitcoin",
      "data": {
        "price": 50000,
        "marketCap": 900000000000,
        "change24h": 2.5
      }
    }
    ```
* **Client → Server: `subscribeToCoin`**

  * Use to express interest in particular coin updates:

    ```js
    socket.emit("subscribeToCoin", { coinId: "bitcoin" });
    ```

---

## CI/CD Pipeline Simulation

CryptoPulse includes a **locally simulated CI/CD pipeline** using Bash scripts and Git hooks.

### 1. Automation & Checks

* **Smart Change Detection:**

  * `deploy.sh` analyzes `git diff` to determine which services changed.
  * Only modified microservices are rebuilt and redeployed.

* **Git Hooks (Husky):**

  * `pre-commit`:

    * Runs lint/tests (`ci-pre-commit-check.sh`).
    * Prevents committing broken code.
  * `pre-push`:

    * Performs final checks before pushing (`ci-pre-push-check.sh`).
  * `post-commit`:

    * Triggers `cicd-check.sh`, which runs `deploy.sh` in the background.

### 2. Zero-Downtime Deployment (Blue-Green)

`deploy.sh` implements a **Blue-Green Deployment** strategy:

1. **Spin Up Green:**

   * Launch new containers (Green) alongside existing (Blue).
2. **Health Checks:**

   * Polls health endpoints to ensure Green is ready.
3. **Traffic Switch:**

   * Reroutes traffic to Green if healthy.
4. **Cleanup:**

   * Gracefully stop & remove Blue containers.
5. **Rollback:**

   * If Green fails health checks:

     * Green containers are killed.
     * Blue remains serving traffic.

### 3. Simulation vs Real CI/CD

| Feature               | This Project (Simulated)                | Real Enterprise CI/CD                 |
| --------------------- | --------------------------------------- | ------------------------------------- |
| Execution Environment | Local machine / Docker Compose          | Remote CI servers / cloud runners     |
| Triggers              | Git hooks (`pre-commit`, `post-commit`) | Push, PR, merge events in Git host    |
| Artifacts             | Docker images in local Docker daemon    | Images in Docker Hub, AWS ECR, etc.   |
| Deployment Target     | Local Docker Compose stack              | Remote clusters (K8s, ECS, etc.)      |
| Feedback              | Local logs (`post-commit.log`)          | Dashboards, email/Slack notifications |

---

## Setup & Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CryptoPulse2.0
```

### 2. Environment Variables

Create a `.env` file in the **root** directory (`CryptoPulse2.0/`).

Populate it based on the config files (`config/*.config.js`). Example keys:

* **Core**

  * `PORT` – API Gateway port (e.g., `3000`)
  * `MONGO_URI` – MongoDB connection string
  * `DB_NAME` – e.g. `CryptoPulse`

* **Redis**

  * `REDIS_HOST`
  * `REDIS_PORT`
  * `REDIS_USERNAME`
  * `REDIS_PASSWORD`

* **JWT**

  * `ACCESS_TOKEN_SECRET`
  * `REFRESH_TOKEN_SECRET`
  * `ACCESS_TOKEN_EXPIRY`  (e.g., `15m`)
  * `REFRESH_TOKEN_EXPIRY` (e.g., `7d`)

* **Cloudinary**

  * `CLOUDINARY_CLOUD_NAME`
  * `CLOUDINARY_API_KEY`
  * `CLOUDINARY_API_SECRET`

* **Google OAuth**

  * `GOOGLE_CLIENT_ID`
  * `GOOGLE_CLIENT_SECRET`
  * `GOOGLE_REDIRECT_URI`

* **External API**

  * `CoinGecko_URL_COIN`
  * `CoinGecko_API_KEY` (if applicable)

* **Security**

  * `CORS_ORIGIN` – e.g., `http://localhost:5173`
  * `USER_SECRET_KEY` – shared secret for inter-service security

* **Service URLs (for local dev)**

  * `AUTH_SERVICE_URL` – e.g., `http://auth-service:8001`
  * `DATA_SERVICE_URL` – e.g., `http://data-service:8002`
  * `GRAPHQL_SERVICE_URL` – e.g., `http://graphql-service:8003`
  * `WEBSOCKET_SERVICE_URL` – e.g., `http://websocket-service:8004`


---

## Running the Services

### Option A – Manual (Node.js)

In separate terminals:

```bash
# Terminal 1 – API Gateway
cd api-gateway
npm install
node src/index.js

# Terminal 2 – Auth Service
cd ../auth-service
npm install
node src/index.js

# Terminal 3 – Data Service
cd ../data-service
npm install
node src/index.js

# Terminal 4 – Worker Service
cd ../worker-service
npm install
node src/index.js

# Terminal 5 – Scheduler Service
cd ../scheduler-service
npm install
node src/index.js

# Terminal 6 – WebSocket Service
cd ../websocket-service
npm install
node src/index.js

# Terminal 7 – GraphQL Service
cd ../graphql-service
npm install
node src/index.js
```

---

### Option B – Docker Compose (Recommended)

> Ensure you’ve fixed the Redis volume path in `docker-compose.yml` if needed.

#### Build & Run (with Scaling)

From the project root:

```bash
docker-compose up -d --build \
  --scale api-gateway=2 \
  --scale auth-service=2 \
  --scale data-service=3 \
  --scale worker-service=4 \
  --scale scheduler-service=1 \
  --scale websocket-service=2 \
  --scale graphql-service=1
```

#### Load Testing

A `load-tester` service is configured using `yamaszone/hey`.

* **High Load Test (100 requests, 50 concurrent)**

  ```bash
  docker-compose run --rm load-tester \
    -n 100 -c 50 "http://api-gateway:3000/api/v1/coins"
  ```

* **Rate Limit Test (200 requests, 50 concurrent)**

  ```bash
  docker-compose run --rm load-tester \
    -n 200 -c 50 "http://api-gateway:3000/api/v1/coins"
  ```

---

### Accessing the Application

* **API Gateway:**
  `http://localhost:3000`

* **REST Endpoints:**
  `http://localhost:3000/api/v1/...`

* **GraphQL Endpoint & Playground:**
  `http://localhost:3000/graphql`

* **WebSockets (via Gateway):**
  `ws://localhost:3000/socket.io/`

---

## Testing

Testing is implemented primarily via **Jest** (and optionally **Supertest** for HTTP level):

* **Unit Tests:**

  * Controllers (e.g., auth)
  * Middleware (e.g., auth)

<!-- * **Integration Tests:**

  * Selected endpoints with mocked external dependencies (DB, Redis, external APIs) -->

### Running Tests

From a given service directory (e.g., `auth-service`):

```bash
cd auth-service
npm test
```

The CI hooks run these tests automatically at:

* `pre-commit` – to prevent committing failing code
* `pre-push` – to prevent pushing failing code to remote

---

## Logging

Each service uses **Winston** for structured logging and **Morgan** for HTTP logging (where applicable).

* Logs are usually stored in a `logs/` directory under each service:

  * `api-gateway/logs/`
  * `auth-service/logs/`
  * `data-service/logs/`
  * etc.

* Typical log levels:

  * `error`
  * `warn`
  * `info` / `http`
  * `debug` (optional)

* **Request ID Integration:**

  * All HTTP logs include the `X-Request-Id` UUID.
  * This allows you to trace a single user request through:

    * Gateway logs
    * Auth/Data service logs
    * Worker jobs (if linked)
    * WebSocket handshake logs

---

## Future Improvements

Some potential enhancements:

* Kubernetes for production deployment
* Centralized logging & monitoring (e.g., ELK/EFK stack or Prometheus + Grafana)
* Role-based access control (RBAC) for advanced user permissions
* Tiered plans (Free, Pro) with dynamic rate limiting and feature flags
* More advanced analytics and configurable alerts (e.g., price triggers)

---

**CryptoPulse** demonstrates backend & architecture skills, microservices best practices, DevOps concepts (CI/CD + Blue-Green), resilience patterns, real-time communication, and **end-to-end request tracing using UUID request IDs across services**.
