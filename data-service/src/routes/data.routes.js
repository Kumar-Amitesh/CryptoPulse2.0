import Router from 'express'
import { getPaginatedCoins, getCoinById, getCoinHistory } from '../controllers/data.controllers.js'

const router = Router()

router.route('/').get(getPaginatedCoins)
router.route('/:id').get(getCoinById)
router.route('/history/:coinId').get(getCoinHistory)

export default router