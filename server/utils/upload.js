/**
 * Multer + Cloudinary upload utility.
 *
 * Strategy: Multer buffers the file in memory, then a helper function
 * streams it to Cloudinary using the SDK's upload_stream API.
 * This avoids writing any file to disk and eliminates the need for the
 * unmaintained multer-storage-cloudinary bridge package.
 *
 * Usage in a route:
 *   import { uploadSingle, streamToCloudinary } from "../utils/upload.js";
 *
 *   router.post("/avatar", uploadSingle("avatar"), async (req, res, next) => {
 *     if (!req.file) throw ApiError.badRequest("Image file is required.");
 *     const result = await streamToCloudinary(req.file.buffer, "avatars");
 *     // result.secure_url  → store in DB
 *     // result.public_id   → store in DB for future deletion
 *   });
 */

import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import ApiError from "./ApiError.js";

// ─── Multer configuration ────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest("Only JPEG, PNG, WebP, and GIF images are allowed."));
  }
};

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/** Middleware: accept a single file from the given field name. */
export const uploadSingle = (fieldName) => multerInstance.single(fieldName);

/** Middleware: accept multiple files (up to maxCount) from the given field name. */
export const uploadMultiple = (fieldName, maxCount = 5) =>
  multerInstance.array(fieldName, maxCount);

// ─── Cloudinary stream helper ────────────────────────────────────────────────

/**
 * Uploads a Buffer to Cloudinary and returns the upload result.
 *
 * @param {Buffer} buffer          File buffer from multer's memoryStorage.
 * @param {string} folder          Cloudinary folder path (e.g. "events", "avatars").
 * @param {object} [options={}]    Additional Cloudinary upload options.
 * @returns {Promise<object>}      Cloudinary UploadApiResponse.
 */
export const streamToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        ...options,
      },
      (error, result) => {
        if (error) return reject(ApiError.internal("Image upload failed."));
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes an asset from Cloudinary by its public_id.
 * Called when a user replaces or deletes an uploaded image.
 *
 * @param {string} publicId   The public_id returned by a previous upload.
 * @returns {Promise<object>} Cloudinary deletion result.
 */
export const deleteFromCloudinary = async (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};
