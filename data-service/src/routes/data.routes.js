import Router from 'express'
import { getPaginatedCoins, getCoinById } from '../controllers/data.controllers.js'

const router = Router()

router.route('/').get(getPaginatedCoins)
router.route('/:id').get(getCoinById)

export default router