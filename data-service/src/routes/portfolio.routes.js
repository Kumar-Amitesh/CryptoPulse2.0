import { Router } from 'express';
import { addTransaction, getPortfolioSummary } from '../controllers/portfolio.controllers.js';

const router = Router();

router.route('/transactions').post(addTransaction);

router.route('/summary').get(getPortfolioSummary);

export default router;