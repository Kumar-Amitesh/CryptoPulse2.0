import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import ApiResponse from '../utils/ApiResponse.utils.js';
import Watchlist from '../models/WatchList.models.js'; // Need Watchlist model for popular coins
import Transaction from '../models/Transaction.models.js'; // Need Transaction model for performance
import PriceSnapshot from '../models/PriceSnapshot.models.js'; // Need PriceSnapshot for history
import logger from '../utils/logger.utils.js';
import { client as redisClient } from '../config/redis.config.js'; // For current prices if needed

const getUserIdFromHeader = (req) => {
  const userId = req.header('X-User-ID');
  // Allow analytics endpoints that don't strictly require a user ID
  // Specific endpoints like portfolio performance will handle the check internally
  // if (!userId) {
  //   throw new ApiError(401, 'Unauthorized - No user ID provided');
  // }
  return userId;
};


/**
 * @description Get most popular coins based on watchlist count
 * @route GET /api/v1/analytics/popular
 * @access Public
 */
const getPopularCoins = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10; 

    const popularCoinsPipeline = [
        {
            $group: {
                _id: "$coinId", // Group by coinId
                count: { $sum: 1 } // Count occurrences
            }
        },
        {
            $sort: { count: -1 } // Sort by count descending
        },
        {
            $limit: limit // Limit the results
        },
        {
            $project: { // Reshape the output
                _id: 0, // Exclude the default _id
                coinId: "$_id",
                watchListCount: "$count"
            }
        }
    ];

    const popularCoinIds = await Watchlist.aggregate(popularCoinsPipeline);

    if (!popularCoinIds || popularCoinIds.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], 'No watchlist data available yet.'));
    }

    // Fetch details for these popular coins from Redis
    const coinIds = popularCoinIds.map(c => c.coinId);
    const coinKeys = coinIds.map(id => `coin:${id}`);
    const coinDataJsonList = await redisClient.mGet(coinKeys);

    const detailedPopularCoins = popularCoinIds.map((popularCoin, index) => {
        let coinDetails = null;
        if (coinDataJsonList[index]) {
            try {
                coinDetails = JSON.parse(coinDataJsonList[index]);
            } catch (e) {
                logger.warn(`Could not parse Redis data for popular coin: ${popularCoin.coinId}`);
            }
        }
        return {
            ...popularCoin,
            name: coinDetails?.name || popularCoin.coinId,
            symbol: coinDetails?.symbol || '',
            image: coinDetails?.image || '',
            currentPrice: coinDetails?.current_price || null,
            priceChange24h: coinDetails?.price_change_percentage_24h_in_currency || null,
            marketCap: coinDetails?.market_cap || null,
        };
    });


    return res.status(200).json(new ApiResponse(200, detailedPopularCoins, 'Popular coins fetched successfully'));
});


export { getPopularCoins };
