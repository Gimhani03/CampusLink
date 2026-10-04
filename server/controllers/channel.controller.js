import * as channelService from "../services/channel.service.js";
import { streamToCloudinary } from "../utils/upload.js";
import catchAsync from "../utils/catchAsync.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Multer delivers multipart boolean fields as strings ("true"/"false").
 * Normalise them so Mongoose validators receive actual booleans.
 */
const parseBooleans = (body) => {
  const out = { ...body };
  if (out.isVerified !== undefined) out.isVerified = out.isVerified === "true" || out.isVerified === true;
  if (out.isActive   !== undefined) out.isActive   = out.isActive   !== "false" && out.isActive !== false;
  return out;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const getAllChannels = catchAsync(async (req, res) => {
  const isAdmin = req.user?.role === "admin";
  const data = await channelService.getAllChannels(req.query, req.user?._id, isAdmin);
  if (isAdmin) res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, data });
});

export const getChannelBySlug = catchAsync(async (req, res) => {
  const data = await channelService.getChannelBySlug(req.params.slug, req.user?._id);
  res.status(200).json({ success: true, data: { channel: data } });
});

export const toggleFollow = catchAsync(async (req, res) => {
  const data = await channelService.toggleFollow(req.params.id, req.user._id);
  res.status(200).json({ success: true, data });
});

export const getFollowedChannels = catchAsync(async (req, res) => {
  const channels = await channelService.getFollowedChannels(req.user._id);
  res.status(200).json({ success: true, data: { channels } });
});

export const createChannel = catchAsync(async (req, res) => {
  const body = parseBooleans(req.body);

  // Upload avatar to Cloudinary if provided.
  if (req.file) {
    const result = await streamToCloudinary(req.file.buffer, "channels/avatars", {
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });
    body.avatar = { url: result.secure_url, publicId: result.public_id };
  }

  const channel = await channelService.createChannel(body, req.user._id);
  res.status(201).json({ success: true, data: { channel } });
});

export const updateChannel = catchAsync(async (req, res) => {
  const body = parseBooleans(req.body);

  // Upload new avatar to Cloudinary if provided.
  if (req.file) {
    const result = await streamToCloudinary(req.file.buffer, "channels/avatars", {
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });
    body.avatar = { url: result.secure_url, publicId: result.public_id };
  }

  const channel = await channelService.updateChannel(req.params.id, body, !!req.file);
  res.status(200).json({ success: true, data: { channel } });
});

export const deleteChannel = catchAsync(async (req, res) => {
  await channelService.deleteChannel(req.params.id);
  res.status(204).send();
});
