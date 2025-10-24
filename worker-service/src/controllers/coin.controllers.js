import Watchlist from '../models/WatchList.models.js'; // Adjust path if necessary
import api from '../utils/axiosInstance.utils.js'; // Adjust path
import { client as redisClient } from '../config/redis.config.js'; // Adjust path
import { COINS_PER_PAGE, WATCHLIST_BATCH_SIZE } from '../constants.js'; // Adjust path

// --- Caching Logic (from old work-server/index.js) ---
const cacheCoinsData = async (allCoinData) => {
    // ... (Keep the exact same logic as before)
    if (allCoinData.length === 0) {
        console.log("No data to cache.");
        return;
    }

    const sortedCoins = allCoinData.sort(
        (a, b) => (a.market_cap_rank || 9999) - (b.market_cap_rank || 9999)
    );

    const page1_ids = sortedCoins.slice(0, COINS_PER_PAGE).map((coin) => coin.id);
    const page2_ids = sortedCoins
        .slice(COINS_PER_PAGE, COINS_PER_PAGE * 2)
        .map((coin) => coin.id);

    const pipeline = redisClient.multi();

    pipeline.set("page:1", JSON.stringify(page1_ids));
    pipeline.set("page:2", JSON.stringify(page2_ids));

    allCoinData.forEach((coin) => {
        const key = `coin:${coin.id}`;
        const value = JSON.stringify(coin);
        // Consider slightly longer expiry for worker? Or keep it short.
        pipeline.set(key, value, { EX: 300 }); // 5 minutes expiry
    });

    try {
        await pipeline.exec();
        console.log(
            `Successfully cached ${allCoinData.length} individual coins and 2 page keys.`
        );
    } catch (err) {
        console.error("Error executing Redis pipeline:", err);
    }
};

// --- Top Coins Update Job (from old work-server/index.js runUpdateJob) ---
export const updateTopCoinsJob = async () => {
    console.log("WORKER: Starting top coins data update...");
    let allCoinData = []; //

    try {
        const params = { //
            vs_currency: "usd", //
            price_change_percentage: "1h,24h,7d", // Keep it lean for top coins
            per_page: COINS_PER_PAGE, //
        };

        // Fetch pages concurrently
        const [page1Response, page2Response] = await Promise.all([
            api.get("/", { params: { ...params, page: 1 } }), //
            api.get("/", { params: { ...params, page: 2 } }), //
        ]);

        allCoinData = [...page1Response.data, ...page2Response.data]; //
        console.log(`WORKER: Fetched ${allCoinData.length} top coins.`); //

        await cacheCoinsData(allCoinData); //
        console.log("WORKER: Finished top coins data update."); //
    } catch (error) {
        console.error("WORKER: Error fetching top coins data:", error.message); //
    }
};

// --- Watchlist Update Job (from old work-server/index.js runWatchlistUpdateJob) ---
export const updateWatchlistCoinsJob = async () => {
    console.log("WORKER: Starting watchlist coin data update..."); //
    try {
        // Find distinct coinIds from the Watchlist collection
        const allWatchlistedIds = await Watchlist.distinct("coinId");

        if (allWatchlistedIds.length === 0) { //
            console.log("WORKER: No watchlisted coins to update."); //
            return; //
        }

        const redisKeys = allWatchlistedIds.map((id) => `coin:${id}`); //

        // Check which coins are already in Redis
        const results = await redisClient.mGet(redisKeys); //

        const coinsToFetch = []; //
        results.forEach((result, index) => { //
            if (result === null) { // If not found in cache
                coinsToFetch.push(allWatchlistedIds[index]); // Add to fetch list
            }
        });

        if (coinsToFetch.length === 0) { //
            console.log("WORKER: All watchlisted coins are already in the cache."); //
            return; //
        }

        console.log(`WORKER: Found ${coinsToFetch.length} watchlist coins missing from cache.`); //

        // Fetch missing coins in batches
        for (let i = 0; i < coinsToFetch.length; i += WATCHLIST_BATCH_SIZE) {
            const batchIds = coinsToFetch.slice(i, i + WATCHLIST_BATCH_SIZE); //
            const idsString = batchIds.join(","); // CoinGecko needs comma-separated IDs

            // Fetch data for the batch - Note: CoinGecko /coins/markets takes 'ids' param
            const response = await api.get("/", { //
                params: {
                    vs_currency: "usd", //
                    ids: idsString, // Pass the specific IDs
                    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y", // More data for watchlist
                },
            });

            const newCoinsData = response.data; //

            // Cache the newly fetched data
            if (newCoinsData && newCoinsData.length > 0) {
                const pipeline = redisClient.multi(); //
                newCoinsData.forEach((coin) => { //
                    const key = `coin:${coin.id}`; //
                    const value = JSON.stringify(coin); //
                    // Use a slightly longer expiry for watchlist items? e.g., 10 mins
                    pipeline.set(key, value, { EX: 600 }); //
                });
                await pipeline.exec(); //
                console.log(`WORKER: Cached ${newCoinsData.length} watchlist coins from batch starting at index ${i}.`); //
            } else {
                 console.log(`WORKER: No data returned for watchlist batch: ${idsString}`);
            }


            // Pause slightly between batches if needed to respect API rate limits
            if (i + WATCHLIST_BATCH_SIZE < coinsToFetch.length) {
                await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second pause
            }
        }
        console.log("WORKER: Finished watchlist coin data update.");
    } catch (error) {
        console.error("WORKER: Error fetching watchlist data:", error.message); //
    }
};