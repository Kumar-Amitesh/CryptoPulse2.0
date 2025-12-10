import { client as redisClient } from '../config/redis.config.js';
import { coinTrie } from './Trie.utils.js';
import logger from './logger.utils.js';
import PriceSnapshot from '../models/PriceSnapshot.models.js';

export const loadTrieFromCache = async () => {
    try {
        // Assuming worker caches 'page:1:data', 'page:2:data', etc.
        const pageKeys = await redisClient.keys('page:*:data');
        
        // Fetch all pages in parallel
        const results = await Promise.all(pageKeys.map(key => redisClient.get(key)));

        

        let count = 0;
        if(results.length === 0) {
            logger.warn('No cached pages found in Redis to build Trie.');
            const result_db = await PriceSnapshot.find();
            result_db.forEach(coin => {
                const searchData = {
                    id: coin.coinId,
                    name: coin.name,
                    symbol: coin.symbol,
                    image: coin.image,
                    // current_price: coin.current_price
                };
                // Insert Name (e.g. "Bitcoin")
                coinTrie.insert(coin.name, searchData);
                // Insert Symbol (e.g. "BTC")
                coinTrie.insert(coin.symbol, searchData);
                count++;
            });
        }
        else{
            results.forEach(pageJson => {
                if (!pageJson) return;
                const coins = JSON.parse(pageJson);
                
                coins.forEach(coin => {
                    const searchData = {
                        id: coin.id,
                        name: coin.name,
                        symbol: coin.symbol,
                        image: coin.image,
                        // current_price: coin.current_price
                    };

                    // Insert Name (e.g. "Bitcoin")
                    coinTrie.insert(coin.name, searchData);
                    // Insert Symbol (e.g. "BTC")
                    coinTrie.insert(coin.symbol, searchData);
                    count++;
                });
            });
        }

        logger.info(`Trie populated with ${count} search entries.`);
    } catch (error) {
        logger.error('Error populating search Trie:', error);
    }
};

export default loadTrieFromCache;




// import { client as redisClient } from '../config/redis.config.js';
// import { coinTrie } from './Trie.utils.js';
// import logger from './logger.utils.js';

// export const loadTrieFromCache = async () => {
//     try {
//         // Get all cached pages dynamically
//         const pageKeys = await redisClient.keys('page:*:data');

//         if (pageKeys.length === 0) {
//             logger.warn('No cached pages found in Redis to build Trie.');
//             return;
//         }

//         const results = await Promise.all(pageKeys.map(key => redisClient.get(key)));

//         let insertCount = 0;
//         const inserted = new Set(); // prevent duplicates by id

//         for (const pageJson of results) {
//             if (!pageJson) continue;

//             const coins = JSON.parse(pageJson);

//             for (const coin of coins) {
//                 if (inserted.has(coin.id)) continue;
//                 inserted.add(coin.id);

//                 const searchData = {
//                     id: coin.id,
//                     name: coin.name,
//                     symbol: coin.symbol,
//                     image: coin.image,
//                     current_price: coin.current_price
//                 };

//                 coinTrie.insert(coin.name, searchData);
//                 coinTrie.insert(coin.symbol, searchData);

//                 insertCount += 2;
//             }
//         }

//         logger.info(
//             `Trie populated successfully - ${inserted.size} unique coins, ${insertCount} index entries`
//         );

//     } catch (error) {
//         logger.error('Error populating search Trie:', error);
//     }
// };
