import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Payments route active' });
});

export const paymentRouter = router;
export const paymentsRouter = router;
export default router;
