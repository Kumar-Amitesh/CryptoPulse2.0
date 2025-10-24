import { Router } from 'express';
import { getPopularCoins } from '../controllers/analytics.controllers.js';

const router = Router();

router.route('/popular').get(getPopularCoins);

export default router;
