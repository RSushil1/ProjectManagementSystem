import { Router } from 'express';
import { z } from 'zod';
import { login, register, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginLimiter, registerLimiter, refreshLimiter } from '../middlewares/rateLimiter';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
});

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/logout', logout);

export default router;
