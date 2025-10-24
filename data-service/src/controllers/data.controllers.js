import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import ApiResponse from '../utils/ApiResponse.utils.js';
import logger from '../utils/logger.utils.js';
import { client as redisClient } from '../config/redis.config.js';

/**
 * Gets the paginated list of coins for the homepage.
 * Reads from Redis cache.
 */
const getPaginatedCoins = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  if (page < 1 || page > 2) {
    throw new ApiError(400, 'Page must be 1 or 2');
  }

  // 1. Get the list of coin IDs for the requested page
  const pageKey = `page:${page}`;
  const pageIdsJson = await redisClient.get(pageKey);

  if (!pageIdsJson) {
    // This can happen if the worker hasn't run yet.
    throw new ApiError(503, 'Coin data is not available yet. Please try again in a moment.');
  }

  const pageIds = JSON.parse(pageIdsJson);

  if (!pageIds || pageIds.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], 'No coins found for this page.'));
  }

  // 2. Build the list of keys to fetch (e.g., ["coin:bitcoin", "coin:ethereum", ...])
  const coinKeys = pageIds.map((id) => `coin:${id}`);

  // 3. Fetch all coin data from Redis in one go
  const coinDataJsonList = await redisClient.mGet(coinKeys);

  // 4. Parse the data and filter out any potential nulls (if a coin key expired)
  const coinData = coinDataJsonList
    .filter((data) => data !== null)
    .map((data) => JSON.parse(data));

  return res
    .status(200)
    .json(new ApiResponse(200, coinData, 'Coins fetched successfully'));
});

/**
 * Gets a single coin's data by its ID.
 * Reads from Redis cache.
 */

const getCoinById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const coinKey = `coin:${id}`;

  const coinDataJson = await redisClient.get(coinKey);

  if (!coinDataJson) {
    // This could be an invalid ID or the cache just expired.
    throw new ApiError(404, 'Coin not found or data is being updated.');
  }

  const coinData = JSON.parse(coinDataJson);

  return res
    .status(200)
    .json(new ApiResponse(200, coinData, 'Coin data fetched successfully'));
});


export { getPaginatedCoins, getCoinById };