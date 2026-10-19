import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { message, ok, userId } from "../../utils/response";
import { storyService } from "./story.service";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  ok(res, await storyService.listFeed(userId(req)));
});

router.post("/", requireAuth, async (req, res) => {
  const { mediaUrl, mediaType, caption } = req.body ?? {};
  if (!mediaUrl || !mediaType) {
    return res.status(400).json({ success: false, message: "mediaUrl and mediaType required" });
  }
  ok(res, await storyService.create(userId(req), { mediaUrl, mediaType, caption }), undefined, 201);
});

router.post("/:id/view", requireAuth, async (req, res) => {
  await storyService.markViewed(req.params.id as string, userId(req));
  message(res, "Viewed");
});

router.delete("/:id", requireAuth, async (req, res) => {
  await storyService.delete(req.params.id as string, userId(req));
  message(res, "Deleted");
});

export default router;
