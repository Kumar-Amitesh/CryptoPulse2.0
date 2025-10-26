// Using template literals to define the schema directly in JS
// For larger schemas, consider using .graphql files and tools to load them.

const typeDefs = `#graphql
  scalar Date

  type User {
    _id: ID!
    username: String!
    email: String!
    fullName: String!
    avatar: String
    createdAt: Date
    updatedAt: Date
    # Note: Sensitive fields like password, refreshToken are excluded
  }

  type Coin {
    id: String!
    symbol: String
    name: String
    image: String
    current_price: Float
    market_cap: Float
    market_cap_rank: Int
    fully_diluted_valuation: Float
    total_volume: Float
    high_24h: Float
    low_24h: Float
    price_change_24h: Float
    price_change_percentage_24h: Float
    market_cap_change_24h: Float
    market_cap_change_percentage_24h: Float
    circulating_supply: Float
    total_supply: Float
    max_supply: Float
    ath: Float
    ath_change_percentage: Float
    ath_date: String # Consider mapping to Date scalar if needed
    atl: Float
    atl_change_percentage: Float
    atl_date: String # Consider mapping to Date scalar if needed
    roi: Roi
    last_updated: String # Consider mapping to Date scalar if needed
    price_change_percentage_1h_in_currency: Float
    price_change_percentage_24h_in_currency: Float
    price_change_percentage_7d_in_currency: Float
    # Add other fields as available from CoinGecko/your data service
  }

  type Roi {
      times: Float
      currency: String
      percentage: Float
  }

  type WatchlistItem {
    _id: ID!
    user: ID! # Or type User if you add a resolver for it
    coinId: String!
    createdAt: Date
    updatedAt: Date
    # You might add a 'coin' field of type Coin here and resolve it
    coin: Coin # Resolved separately
  }

   type Transaction {
    _id: ID!
    user: ID!
    coinId: String!
    type: TransactionType!
    quantity: Float!
    pricePerCoin: Float!
    transactionDate: Date!
    createdAt: Date
    updatedAt: Date
    # Add 'coin' field of type Coin if needed
    coin: Coin # Resolved separately
  }

  enum TransactionType {
    buy
    sell
  }

  type Holding {
    coinId: String!
    name: String
    symbol: String
    image: String
    quantity: Float!
    costBasis: Float!
    currentPrice: Float
    currentValue: Float
    profitLoss: Float
    profitLossPercent: Float
    price_change_percentage_24h: Float
  }

  type PortfolioSummary {
    holdings: [Holding!]!
    totalValue: Float!
    totalCostBasis: Float!
    totalProfitLoss: Float!
    totalProfitLossPercent: Float!
  }

  type PriceSnapshot {
    timestamp: Date!
    price: Float!
    open: Float
    high: Float
    low: Float
  }

  type PopularCoin {
      coinId: String!
      watchListCount: Int!
      name: String
      symbol: String
      image: String
      currentPrice: Float
      priceChange24h: Float
      marketCap: Float
  }

  # ----- QUERIES -----
  type Query {
    "Get the currently logged-in user's details"
    currentUser: User

    "Get a paginated list of coins (page 1 or 2)"
    coins(page: Int = 1): [Coin!]!

    "Get details for a specific coin by its ID (e.g., 'bitcoin')"
    coin(id: String!): Coin

    "Get the user's watchlist"
    watchlist: [Coin!] # Returns list of Coin details

    "Get the user's portfolio summary"
    portfolioSummary: PortfolioSummary

    "Get historical price data for a coin"
    coinHistory(coinId: String!, interval: String = "day", days: Int = 30): [PriceSnapshot!]!

    "Get popular coins based on watchlist counts"
    popularCoins(limit: Int = 10): [PopularCoin!]!
  }

  # ----- MUTATIONS -----
  type Mutation {
    "Add a coin to the user's watchlist"
    addToWatchlist(coinId: String!): WatchlistItem!

    "Remove a coin from the user's watchlist"
    removeFromWatchlist(coinId: String!): Boolean # Indicate success/failure

    "Add a transaction to the user's portfolio"
    addTransaction(
        coinId: String!,
        type: TransactionType!,
        quantity: Float!,
        pricePerCoin: Float!,
        transactionDate: Date # Optional, defaults to now
    ): Transaction!

    # Note: Login/Register/Logout/Refresh are complex involving cookies/tokens.
    # It's often simpler to keep these as REST endpoints for now.
    # If implemented here, they would return AuthPayload containing tokens/user.

    # Example (Conceptual - Requires careful handling of cookies/state):
    # login(emailOrUsername: String!, password: String!): AuthPayload
    # register(username: String!, email: String!, fullName: String!, password: String!): User
    # logout: Boolean
    # refreshToken: AuthPayload
  }

  # Conceptual payload for auth mutations
  # type AuthPayload {
  #   user: User
  #   accessToken: String
  #   refreshToken: String # Often handled via cookies instead of payload
  # }

`;

export default typeDefs;
