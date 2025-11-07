import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import ApiResponse from '../utils/ApiResponse.utils.js';
import logger from '../utils/logger.utils.js';
import { client as redisClient } from '../config/redis.config.js';
import PriceSnapshot from '../models/PriceSnapshot.models.js';

/**
 * Gets the paginated list of coins for the homepage.
 * Reads from Redis cache.
 */
const getPaginatedCoins = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  if (page < 1 || page > 2) {
    throw new ApiError(400, 'Page must be 1 or 2');
  }


  const pageKey = `page:${page}:data`;
  const pageDataJson = await redisClient.get(pageKey);

  if (!pageDataJson) {
    throw new ApiError(503, 'Coin data is not available yet. Please try again in a moment.');
  }

  const coinData = JSON.parse(pageDataJson);

  if (!coinData || coinData.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], 'No coins found for this page.'));
  }


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
    throw new ApiError(404, 'Coin not found or data is being updated.');
  }

  const coinData = JSON.parse(coinDataJson);

  return res
    .status(200)
    .json(new ApiResponse(200, coinData, 'Coin data fetched successfully'));
});


/**
 * @description Get historical price data for a specific coin
 * @route GET /api/v1/coins/history/:coinId
 * @access Public
 */
const getCoinHistory = asyncHandler(async (req, res) => {
    const { coinId } = req.params;
    const { interval = 'day', days = '30' } = req.query; // interval: 'hour' or 'day', days: number of days back

    let groupByFormat;
    let dateMatchCondition;
    const now = new Date();
    const daysNum = parseInt(days);

    if (isNaN(daysNum) || daysNum <= 0) {
        throw new ApiError(400, 'Invalid number of days specified.');
    }

    const startDate = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);
    dateMatchCondition = { $gte: startDate };

    switch (interval) {
        case 'hour':
            groupByFormat = {
                year: { $year: "$timestamp" },
                month: { $month: "$timestamp" },
                day: { $dayOfMonth: "$timestamp" },
                hour: { $hour: "$timestamp" },
            };
            break;
        case 'day':
            groupByFormat = {
                year: { $year: "$timestamp" },
                month: { $month: "$timestamp" },
                day: { $dayOfMonth: "$timestamp" },
            };
            break;
        default:
            throw new ApiError(400, 'Invalid interval specified. Use "hour" or "day".');
    }


    const historyPipeline = [
        {
            $match: {
                coinId: coinId,
                timestamp: dateMatchCondition
            }
        },
        {
            $sort: { timestamp: 1 } 
        },
        {
            $group: {
                _id: groupByFormat,
                // closing price (last price in the interval)
                closePrice: { $last: "$price" },
                 // open, high, low if needed for candlestick
                 openPrice: { $first: "$price" },
                 highPrice: { $max: "$price" },
                 lowPrice: { $min: "$price" },
                // timestamp of the last record in the group
                timestamp: { $last: "$timestamp" }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } 
        },
        {
            $project: {
                _id: 0,
                timestamp: "$timestamp", // actual timestamp from the last record
                price: "$closePrice", // Rename closePrice to price for simplicity
                // include open, high, low
                 open: "$openPrice",
                 high: "$highPrice",
                 low: "$lowPrice",
            }
        }
    ];

    const historicalData = await PriceSnapshot.aggregate(historyPipeline);

    if (!historicalData) {
        throw new ApiError(500, "Failed to fetch historical data.");
    }

    if (historicalData.length === 0) {
        // Check if the coin itself exists in Redis to differentiate no history vs no coin
        const coinExists = await redisClient.exists(`coin:${coinId}`);
         if (!coinExists) {
             throw new ApiError(404, `Coin with ID '${coinId}' not found.`);
         } else {
            // Coin exists, but no history in the requested range
             return res.status(200).json(new ApiResponse(200, [], `No historical data found for '${coinId}' in the last ${days} days with '${interval}' interval.`));
         }
    }


    return res.status(200).json(new ApiResponse(200, historicalData, `Historical data for ${coinId} fetched successfully`));
});

export { getPaginatedCoins, getCoinById, getCoinHistory };