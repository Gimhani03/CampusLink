import { Router } from "express";
import authenticate        from "../middleware/authenticate.js";
import authorise           from "../middleware/authorize.js";
import { uploadSingle }    from "../utils/upload.js";
import * as ctrl           from "../controllers/channel.controller.js";

const router = Router();

// ── Public / student ──────────────────────────────────────────────────────────

router.get("/",              authenticate, ctrl.getAllChannels);
router.get("/following",     authenticate, ctrl.getFollowedChannels);
router.get("/:slug",         authenticate, ctrl.getChannelBySlug);
router.post("/:id/follow",   authenticate, authorise("student"), ctrl.toggleFollow);

// ── Admin (multipart/form-data to support optional avatar upload) ─────────────

router.post(  "/",    authenticate, authorise("admin"), uploadSingle("avatar"), ctrl.createChannel);
router.put(   "/:id", authenticate, authorise("admin"), uploadSingle("avatar"), ctrl.updateChannel);
router.delete("/:id", authenticate, authorise("admin"), ctrl.deleteChannel);

export default router;
