/**
 * Check-in Controller — admin attendance + public pass display.
 */

import catchAsync from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as checkInService from "../services/checkIn.service.js";

/** GET /api/v1/passes/:token — public pass page (token is the secret). */
export const getPublicPass = catchAsync(async (req, res) => {
  const pass = await checkInService.getPublicPass(req.params.token);
  res.status(200).json(new ApiResponse(200, { pass }, "Pass fetched."));
});

/** GET /api/v1/admin/check-in/:token — preview attendee before check-in. */
export const lookupCheckIn = catchAsync(async (req, res) => {
  const attendee = await checkInService.lookupCheckIn(req.params.token);
  res.status(200).json(new ApiResponse(200, { attendee }, "Pass lookup successful."));
});

/** POST /api/v1/admin/check-in/:token — mark attendance. */
export const markCheckIn = catchAsync(async (req, res) => {
  const result = await checkInService.markCheckIn(req.params.token);
  res.status(200).json(new ApiResponse(200, result, result.message));
});
