/**
 * Pagination utility.
 *
 * Used by every service that returns a list of documents.
 * Centralising these calculations ensures consistent pagination
 * metadata shape across all API endpoints.
 */

/**
 * Parses and sanitises page / limit from raw query string values.
 *
 * @param {*}      rawPage   req.query.page
 * @param {*}      rawLimit  req.query.limit
 * @param {number} maxLimit  Hard ceiling on results per page (default 50).
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const parsePagination = (rawPage, rawLimit, maxLimit = 50) => {
  const page  = Math.max(1, parseInt(rawPage,  10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(rawLimit, 10) || 10));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Builds the pagination metadata block included in every list response.
 *
 * @param {number} total  Total documents matching the filter (from countDocuments).
 * @param {number} page   Current page number.
 * @param {number} limit  Page size.
 * @returns {object}
 */
export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
