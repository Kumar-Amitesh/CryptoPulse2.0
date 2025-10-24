import Router from 'express'
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../controllers/watchlist.controllers.js'

const router = Router()

router.route('/').get(getWatchlist).post(addToWatchlist)
router.route('/:coinId').delete(removeFromWatchlist)

export default router