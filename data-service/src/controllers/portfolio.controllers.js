import asyncHandler from '../utils/asyncHandler.utils.js';
import ApiError from '../utils/ApiError.utils.js';
import ApiResponse from '../utils/ApiResponse.utils.js';
import Transaction from '../models/Transaction.models.js';
import { client as redisClient } from '../config/redis.config.js';
import logger from '../utils/logger.utils.js';

const getUserIdFromHeader = (req) => {
  const userId = req.header('X-User-ID'); 
  if (!userId) {
    throw new ApiError(401, 'Unauthorized - No user ID provided');
  }
  return userId;
};

/**
 * @description Add a new transaction (buy/sell) for the user
 * @route POST /api/v1/portfolio/transactions
 * @access Private
 */
const addTransaction = asyncHandler(async (req, res) => {
    const userId = getUserIdFromHeader(req);
    const { coinId, type, quantity, pricePerCoin, transactionDate } = req.body;

    if (!coinId || !type || !quantity || pricePerCoin === undefined) {
        throw new ApiError(400, 'Missing required fields: coinId, type, quantity, pricePerCoin');
    }
    if (type !== 'buy' && type !== 'sell') {
        throw new ApiError(400, 'Invalid transaction type. Must be "buy" or "sell".');
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
        throw new ApiError(400, 'Quantity must be a positive number.');
    }
     if (typeof pricePerCoin !== 'number' || pricePerCoin < 0) {
        throw new ApiError(400, 'Price per coin must be a non-negative number.');
    }

    const transactionData = {
        user: userId,
        coinId,
        type,
        quantity,
        pricePerCoin,
    };

    if (transactionDate) {
        const parsedDate = new Date(transactionDate);
        if (isNaN(parsedDate)) {
             throw new ApiError(400, 'Invalid transaction date format.');
        }
        transactionData.transactionDate = parsedDate;
    }


    const newTransaction = await Transaction.create(transactionData);

    return res
        .status(201)
        .json(new ApiResponse(201, newTransaction, 'Transaction added successfully'));
});


/**
 * @description Get portfolio summary (holdings, total value, profit/loss)
 * @route GET /api/v1/portfolio/summary
 * @access Private
 */
const getPortfolioSummary = asyncHandler(async (req, res) => {
    const userId = getUserIdFromHeader(req);

    const transactions = await Transaction.find({ user: userId }).sort({ transactionDate: 1 }); 

    if (!transactions || transactions.length === 0) {
        return res.status(200).json(new ApiResponse(200, { holdings: [], totalValue: 0, totalCostBasis: 0, totalProfitLoss: 0, totalProfitLossPercent: 0 }, 'Portfolio is empty.'));
    }

    const holdings = {}; // { coinId: { quantity: number, costBasis: number }, ... }
    const uniqueCoinIds = new Set();

    transactions.forEach(tx => {
        uniqueCoinIds.add(tx.coinId);
        if (!holdings[tx.coinId]) {
            holdings[tx.coinId] = { quantity: 0, costBasis: 0 };
        }

        if (tx.type === 'buy') {
            holdings[tx.coinId].quantity += tx.quantity;
            holdings[tx.coinId].costBasis += tx.quantity * tx.pricePerCoin;
        } else { 
            // Reduce quantity and proportionally reduce cost basis
            const proportionSold = tx.quantity / (holdings[tx.coinId].quantity + tx.quantity); // Careful: quantity before this sell
            const costOfSold = holdings[tx.coinId].costBasis * proportionSold;

            holdings[tx.coinId].quantity -= tx.quantity;
            holdings[tx.coinId].costBasis -= costOfSold;

            // Handle potential floating point inaccuracies or selling more than owned (though ideally validated elsewhere)
            if (holdings[tx.coinId].quantity < 0.00000001) holdings[tx.coinId].quantity = 0;
            if (holdings[tx.coinId].costBasis < 0) holdings[tx.coinId].costBasis = 0;

        }
    });

    // Filter out coins that have been completely sold
    const currentHoldings = Object.entries(holdings)
        .filter(([coinId, data]) => data.quantity > 0.00000001) // Use a small threshold for floating point
        .reduce((acc, [coinId, data]) => {
            acc[coinId] = data;
            return acc;
        }, {});

    const coinIdsToFetch = Object.keys(currentHoldings);

    if (coinIdsToFetch.length === 0) {
         return res.status(200).json(new ApiResponse(200, { holdings: [], totalValue: 0, totalCostBasis: 0, totalProfitLoss: 0, totalProfitLossPercent: 0 }, 'No current holdings.'));
    }


    // Get current prices from Redis
    const coinKeys = coinIdsToFetch.map(id => `coin:${id}`);
    const currentPriceDataJson = await redisClient.mGet(coinKeys);

    let totalPortfolioValue = 0;
    let totalPortfolioCostBasis = 0;
    const detailedHoldings = [];

    // Calculate current value, profit/loss for each holding and totals
    currentPriceDataJson.forEach((jsonData, index) => {
        const coinId = coinIdsToFetch[index];
        const holdingData = currentHoldings[coinId];
        let currentPrice = 0;
        let coinDetails = {};

        if (jsonData) {
            try {
                 coinDetails = JSON.parse(jsonData);
                 currentPrice = coinDetails?.current_price || 0;
            } catch (e) {
                logger.warn(`Could not parse Redis data for coin: ${coinId}`);
                // Keep currentPrice = 0
            }
        } else {
             logger.warn(`Current price data missing in Redis for coin: ${coinId}`);
             // Price remains 0, P/L calculation will reflect this missing data
        }

        const currentValue = holdingData.quantity * currentPrice;
        const profitLoss = currentValue - holdingData.costBasis;
        const profitLossPercent = holdingData.costBasis > 0 ? (profitLoss / holdingData.costBasis) * 100 : 0; // Avoid division by zero


        detailedHoldings.push({
            coinId: coinId,
            name: coinDetails?.name || coinId, 
            symbol: coinDetails?.symbol || '',
            image: coinDetails?.image || '',
            quantity: holdingData.quantity,
            costBasis: holdingData.costBasis,
            currentPrice: currentPrice,
            currentValue: currentValue,
            profitLoss: profitLoss,
            profitLossPercent: profitLossPercent,
            price_change_percentage_24h: coinDetails?.price_change_percentage_24h_in_currency || 0,
        });

        totalPortfolioValue += currentValue;
        totalPortfolioCostBasis += holdingData.costBasis;
    });

    const totalProfitLoss = totalPortfolioValue - totalPortfolioCostBasis;
    const totalProfitLossPercent = totalPortfolioCostBasis > 0 ? (totalProfitLoss / totalPortfolioCostBasis) * 100 : 0;

    const summary = {
        holdings: detailedHoldings,
        totalValue: totalPortfolioValue,
        totalCostBasis: totalPortfolioCostBasis,
        totalProfitLoss: totalProfitLoss,
        totalProfitLossPercent: totalProfitLossPercent,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, summary, 'Portfolio summary fetched successfully'));
});


export { addTransaction, getPortfolioSummary };