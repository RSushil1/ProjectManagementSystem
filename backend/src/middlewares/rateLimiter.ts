import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, please try again later' } },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many accounts created from this IP, please try again after an hour' } },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many refresh token requests, please try again later' } },
});
