import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for form submissions
 * Prevents spam and abuse by limiting submissions to 5 per 15-minute window per IP
 * 
 * Configuration:
 * - Window: 15 minutes (900,000 ms)
 * - Max requests: 5 per window
 * - Key: IP address
 * - Response: HTTP 429 with retry-after header
 */
export const formSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: {
    success: false,
    message: 'Too many form submissions. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP address as the key for rate limiting
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    // Custom handler to ensure proper retry-after header
    res.status(429).json({
      success: false,
      message: 'Too many form submissions. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) // Convert to seconds
    });
  },
  skip: (req) => {
    // Skip rate limiting for requests in test environment
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * General API rate limiter (optional - for other endpoints)
 * More lenient limits for general API usage
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});
