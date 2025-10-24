import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import ApiResponse from '../utils/ApiResponse.utils.js';
import Watchlist from '../models/WatchList.models.js'
import { client as redisClient } from '../config/redis.config.js';

// Helper to get user ID and validate
const getUserIdFromHeader = (req) => {
  const userId = req.header('X-User-ID');
  if (!userId) {
    // This error should only happen if the gateway is misconfigured
    throw new ApiError(401, 'Unauthorized - No user ID provided');
  }
  return userId;
};

/**
 * Gets the full coin data for all items on the user's watchlist.
 * 1. Reads Watchlist IDs from MongoDB.
 * 2. Reads full Coin Data from Redis.
 */
const getWatchlist = asyncHandler(async (req, res) => {
  // const userId = req.user._id; 
  const userId = getUserIdFromHeader(req);

  const watchlistItems = await Watchlist.find({ user: userId }).select('coinId');

  if (!watchlistItems || watchlistItems.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], 'Watchlist is empty.'));
  }

  const coinIds = watchlistItems.map((item) => item.coinId);

  const coinKeys = coinIds.map((id) => `coin:${id}`);

  const coinDataJsonList = await redisClient.mGet(coinKeys);

  const coinData = coinDataJsonList
    .filter((data) => data !== null) 
    .map((data) => JSON.parse(data));

  return res
    .status(200)
    .json(
      new ApiResponse(200, coinData, 'Watchlist fetched successfully')
    );
});

/**
 * Adds a single coin to the user's watchlist.
 * Writes to MongoDB.
 */
const addToWatchlist = asyncHandler(async (req, res) => {
  // const userId = req.user._id;
  const userId = getUserIdFromHeader(req);
  const { coinId } = req.body;

  // 1. Validation: Check if the coin is one of the 500 we support
//   if (!SUPPORTED_COINS.includes(coinId)) {
//     throw new ApiError(400, 'This coin is not supported by the application.');
//   }

  const existingItem = await Watchlist.findOne({ user: userId, coinId: coinId });
  if (existingItem) {
    throw new ApiError(400, 'Coin is already on the watchlist.');
  }

  const newWatchlistItem = await Watchlist.create({
    user: userId,
    coinId: coinId,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, newWatchlistItem, 'Coin added to watchlist')
    );
});

/**
 * Removes a single coin from the user's watchlist.
 * Deletes from MongoDB.
 */
const removeFromWatchlist = asyncHandler(async (req, res) => {
  // const userId = req.user._id;
  const userId = getUserIdFromHeader(req);
  const { id: coinId } = req.params; 

  const deletedItem = await Watchlist.findOneAndDelete({
    user: userId,
    coinId: coinId,
  });

  if (!deletedItem) {
    throw new ApiError(404, 'Coin not found on watchlist.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Coin removed from watchlist'));
});

export { getWatchlist, addToWatchlist, removeFromWatchlist };
