import Watchlist from '../models/WatchList.models.js'; 
import api from '../utils/axiosInstance.utils.js';
import { client as redisClient } from '../config/redis.config.js'; 
import { COINS_PER_PAGE, WATCHLIST_BATCH_SIZE, REDIS_COIN_UPDATE_CHANNEL } from '../constants.js'; 
import PriceSnapshot from '../models/PriceSnapshot.models.js';
import logger from '../utils/logger.utils.js';

const savePriceSnapshots = async (allCoinData) => {
    if (!allCoinData || allCoinData.length === 0) {
        logger.warn("WORKER: No coin data provided to save snapshots.");
        return;
    }

    const snapshotTime = new Date(); // consistent timestamp for the batch

    const snapshots = allCoinData.map(coin => ({
        coinId: coin.id,
        price: coin.current_price,
        timestamp: snapshotTime,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume
        // Map other relevant fields if needed
    }));

    try {
        const result = await PriceSnapshot.insertMany(snapshots, { ordered: false }); // ordered: false allows inserting valid ones even if some fail
        logger.info(`WORKER: Successfully saved ${result.length} price snapshots to MongoDB.`);
        console.log(`WORKER: Successfully saved ${result.length} price snapshots to MongoDB.`);
    } catch (error) {
        // Handle potential duplicate key errors if running too frequently, or other DB errors
        if (error.code === 11000) {
             logger.warn("WORKER: Duplicate key error ignored while saving snapshots (likely due to concurrent updates).");
        } else {
            logger.error("WORKER: Error saving price snapshots to MongoDB:", error);
            console.error("WORKER: Error saving price snapshots to MongoDB:", error);
        }
    }
};

const cacheCoinsData = async (allCoinData) => {
    if (allCoinData.length === 0) {
        console.log("No data to cache.");
        return;
    }

    await savePriceSnapshots(allCoinData); // Call the snapshot saving function

    const sortedCoins = allCoinData.sort(
        (a, b) => (a.market_cap_rank || 9999) - (b.market_cap_rank || 9999)
    );
    
    // get the full data for each page
    const page1_data = sortedCoins.slice(0, COINS_PER_PAGE);
    const page2_data = sortedCoins.slice(COINS_PER_PAGE, COINS_PER_PAGE * 2);

    const pipeline = redisClient.multi();

    // Set the new keys with the complete JSON data
    pipeline.set("page:1:data", JSON.stringify(page1_data));
    pipeline.set("page:2:data", JSON.stringify(page2_data));

    // remove the old page:1 and page:2 keys if they exist
    pipeline.del("page:1");
    pipeline.del("page:2");


    allCoinData.forEach((coin) => {
        const key = `coin:${coin.id}`;
        const value = JSON.stringify(coin);
        pipeline.set(key, value, { EX: 300 }); // 5 minutes expiry
    });

    try {
        await pipeline.exec();
        console.log(
            `Successfully cached ${allCoinData.length} individual coins and 2 page data keys.`
        );
        // Publishing Updates 
        if (allCoinData.length > 0 && redisClient.isReady) {
            try {
                const publishPromises = allCoinData.map(coin => {
                    const message = JSON.stringify({
                        coinId: coin.id,
                        data: coin 
                    });
                    return redisClient.publish(REDIS_COIN_UPDATE_CHANNEL, message);
                });
                const results = await Promise.all(publishPromises);
                const successfulPublishes = results.reduce((sum, count) => sum + count, 0); // PUBLISH returns number of clients reached
                logger.info(`WS-PUB: Published updates for ${allCoinData.length} coins to ${successfulPublishes} subscribers on channel '${REDIS_COIN_UPDATE_CHANNEL}'.`);
                console.log(`WS-PUB: Published updates for ${allCoinData.length} coins to channel '${REDIS_COIN_UPDATE_CHANNEL}'.`);

            } catch (publishError) {
                logger.error(`WS-PUB: Error publishing coin updates to Redis channel '${REDIS_COIN_UPDATE_CHANNEL}':`, publishError);
                console.error(`WS-PUB: Error publishing coin updates to Redis:`, publishError);
            }
        }
    } catch (err) {
        console.error("Error executing Redis pipeline:", err);
    }
};

export const updateTopCoinsJob = async () => {
    console.log("WORKER: Starting top coins data update...");
    let allCoinData = []; 

    try {
        const params = { 
            vs_currency: "usd", 
            price_change_percentage: "1h,24h,7d", 
            per_page: COINS_PER_PAGE, 
        };

        // Fetch pages concurrently
        const [page1Response, page2Response] = await Promise.all([
            api.get("/", { params: { ...params, page: 1 } }), 
            api.get("/", { params: { ...params, page: 2 } }), 
        ]);

        allCoinData = [...page1Response.data, ...page2Response.data]; 
        console.log(`WORKER: Fetched ${allCoinData.length} top coins.`); 

        await cacheCoinsData(allCoinData); 
        console.log("WORKER: Finished top coins data update."); 
    } catch (error) {
        console.error("WORKER: Error fetching top coins data:", error.message); 
    }
};

export const updateWatchlistCoinsJob = async () => {
    console.log("WORKER: Starting watchlist coin data update..."); 
    try {
        const allWatchlistedIds = await Watchlist.distinct("coinId");

        if (allWatchlistedIds.length === 0) { 
            console.log("WORKER: No watchlisted coins to update."); 
            return; 
        }

        const redisKeys = allWatchlistedIds.map((id) => `coin:${id}`); 

        // Check which coins are already in Redis
        const results = await redisClient.mGet(redisKeys); 

        const coinsToFetch = []; 
        results.forEach((result, index) => { 
            if (result === null) { 
                coinsToFetch.push(allWatchlistedIds[index]); 
            }
        });

        if (coinsToFetch.length === 0) { 
            console.log("WORKER: All watchlisted coins are already in the cache."); 
            return; 
        }

        console.log(`WORKER: Found ${coinsToFetch.length} watchlist coins missing from cache.`); 

        // Fetch missing coins in batches
        for (let i = 0; i < coinsToFetch.length; i += WATCHLIST_BATCH_SIZE) {
            const batchIds = coinsToFetch.slice(i, i + WATCHLIST_BATCH_SIZE); //
            const idsString = batchIds.join(","); 

            const response = await api.get("/", { 
                params: {
                    vs_currency: "usd", 
                    ids: idsString, 
                    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y", 
                },
            });

            const newCoinsData = response.data; 

            if (newCoinsData && newCoinsData.length > 0) {
                const pipeline = redisClient.multi(); 
                newCoinsData.forEach((coin) => { 
                    const key = `coin:${coin.id}`; 
                    const value = JSON.stringify(coin); 
                    pipeline.set(key, value, { EX: 600 }); 
                });
                await pipeline.exec(); 
                console.log(`WORKER: Cached ${newCoinsData.length} watchlist coins from batch starting at index ${i}.`); 
            } else {
                 console.log(`WORKER: No data returned for watchlist batch: ${idsString}`);
            }

            // Pause slightly between batches if needed to respect API rate limits
            if (i + WATCHLIST_BATCH_SIZE < coinsToFetch.length) {
                await new Promise((resolve) => setTimeout(resolve, 2000)); 
            }
        }
        console.log("WORKER: Finished watchlist coin data update.");
    } catch (error) {
        console.error("WORKER: Error fetching watchlist data:", error.message); 
    }
};