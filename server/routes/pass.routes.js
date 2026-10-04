/**
 * Public pass routes — QR pass display (no auth; token is the credential).
 */

import { Router } from "express";
import { getPublicPass } from "../controllers/checkIn.controller.js";

const router = Router();

router.get("/:token", getPublicPass);

export default router;
