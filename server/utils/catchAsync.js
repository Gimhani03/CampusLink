/**
 * catchAsync
 *
 * Wraps an async Express route handler so any rejected promise
 * is forwarded to Express's next(err) error handler automatically,
 * removing the need for try/catch in every controller.
 *
 * @param {Function} fn  Async (req, res, next) handler
 * @returns {Function}   Standard Express middleware
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
