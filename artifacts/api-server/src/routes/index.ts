import { Router, type IRouter } from "express";
import healthRouter from "./health";
import seatsRouter from "./seats";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import pricingRouter from "./pricing";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(seatsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(pricingRouter);
router.use(adminRouter);

export default router;
