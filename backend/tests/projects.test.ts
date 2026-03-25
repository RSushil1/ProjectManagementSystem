import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/utils/db';
import { redisClient } from '../src/utils/redis';

let ownerToken: string;
let memberToken: string;
let outsiderToken: string;
let projectId: string;
let memberId: string;

beforeAll(async () => {
  // Clean only the users created by this test suite to avoid interfering with auth tests
  await prisma.user.deleteMany({
    where: { email: { in: ['owner@test.com', 'member@test.com', 'outsider@test.com'] } }
  });

  // Register & login owner
  await request(app).post('/api/auth/register').send({ name: 'Owner', email: 'owner@test.com', password: 'password123' });
  const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'password123' });
  ownerToken = ownerLogin.body.data.accessToken;

  // Register & login member
  await request(app).post('/api/auth/register').send({ name: 'Member', email: 'member@test.com', password: 'password123' });
  const memberLogin = await request(app).post('/api/auth/login').send({ email: 'member@test.com', password: 'password123' });
  memberToken = memberLogin.body.data.accessToken;
  const memberUser = await prisma.user.findUnique({ where: { email: 'member@test.com' } });
  memberId = memberUser!.id;

  // Register & login outsider (not in any project)
  await request(app).post('/api/auth/register').send({ name: 'Outsider', email: 'outsider@test.com', password: 'password123' });
  const outsiderLogin = await request(app).post('/api/auth/login').send({ email: 'outsider@test.com', password: 'password123' });
  outsiderToken = outsiderLogin.body.data.accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.quit();
});

describe('Projects API', () => {
  it('1. POST /api/projects — creates a project (owner auto-added)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test Project', description: 'A test project' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Project');
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0].role).toBe('owner');

    projectId = res.body.data.id;
  });

  it('2. POST /api/projects — returns 401 without token', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'No Auth' });
    expect(res.status).toBe(401);
  });

  it('2.5. GET /api/projects — returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('3. GET /api/projects — lists projects for the owner', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('4. GET /api/projects/:id — owner can get project detail', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(projectId);
  });

  it('5. GET /api/projects/:id — outsider gets 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('6. PUT /api/projects/:id — owner can update project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Project', description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Project');
  });

  it('7. POST /api/projects/:id/members — owner can add a member by email', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('member');
    expect(res.body.data.user.email).toBe('member@test.com');
  });

  it('8. GET /api/projects — member can now see the project', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: any) => p.id === projectId);
    expect(found).toBeDefined();
  });

  it('9. POST /api/projects/:id/members — adding same member again returns 400', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@test.com' });

    expect(res.status).toBe(400);
  });

  it('10. DELETE /api/projects/:id/members/:userId — owner can remove a member', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Member removed successfully');
  });

  it('11. DELETE /api/projects/:id — non-owner gets 403', async () => {
    // add member back first
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@test.com' });

    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('12. DELETE /api/projects/:id — owner can delete project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Project deleted successfully');
  });
});
