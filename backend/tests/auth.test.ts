import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/utils/db';
import { redisClient } from '../src/utils/redis';

beforeAll(async () => {
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.quit();
});

describe('Authentication API', () => {
  const dummyUser = {
    name: 'Test Auth User',
    email: 'testauth@example.com',
    password: 'password123'
  };

  it('1. POST /api/auth/register — registers a new user successfully', async () => {
    const res = await request(app).post('/api/auth/register').send(dummyUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(dummyUser.email);
  });

  it('2. POST /api/auth/login — returns access + refresh tokens on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: dummyUser.email,
      password: dummyUser.password
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('3. POST /api/auth/login — returns 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: dummyUser.email,
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
