/**
 * Cloudinary SDK configuration.
 *
 * Configures the v2 Cloudinary SDK using credentials loaded from env.js.
 * Imported by the Multer-Cloudinary storage engine used in upload middleware.
 * Kept as a dedicated module so any service that needs raw Cloudinary access
 * (e.g. deleting an image by public_id) imports from a single source.
 */

import { v2 as cloudinary } from "cloudinary";
import env from "./env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS URLs.
});

export default cloudinary;
