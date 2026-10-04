/**
 * Standardised API response wrapper.
 *
 * Ensures every successful response shares an identical JSON envelope:
 *
 *   {
 *     "success": true,
 *     "statusCode": 200,
 *     "message": "Events fetched successfully",
 *     "data": { ... }
 *   }
 *
 * Controllers call res.status(code).json(new ApiResponse(code, data, message))
 * rather than constructing ad-hoc response objects, keeping the API surface
 * consistent and making frontend parsing predictable.
 */

class ApiResponse {
  /**
   * @param {number} statusCode  HTTP status code.
   * @param {*}      data        Response payload (object, array, or null).
   * @param {string} message     Human-readable success message.
   */
  constructor(statusCode, data, message = "Success") {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;
