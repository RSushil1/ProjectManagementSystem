import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/utils/db';
import { redisClient } from '../src/utils/redis';

let ownerToken: string;
let memberToken: string;
let projectId: string;
let taskId: string;
let memberUserId: string;

beforeAll(async () => {
  // Scope cleanup to only this test suite's users
  await prisma.user.deleteMany({
    where: { email: { in: ['taskowner@test.com', 'taskmember@test.com'] } }
  });

  // Register & login owner
  await request(app).post('/api/auth/register').send({ name: 'Task Owner', email: 'taskowner@test.com', password: 'password123' });
  const ownerLogin = await request(app).post('/api/auth/login').send({ email: 'taskowner@test.com', password: 'password123' });
  ownerToken = ownerLogin.body.data.accessToken;

  // Register & login member
  await request(app).post('/api/auth/register').send({ name: 'Task Member', email: 'taskmember@test.com', password: 'password123' });
  const memberLogin = await request(app).post('/api/auth/login').send({ email: 'taskmember@test.com', password: 'password123' });
  memberToken = memberLogin.body.data.accessToken;
  const memberUser = await prisma.user.findUnique({ where: { email: 'taskmember@test.com' } });
  memberUserId = memberUser!.id;

  // Owner creates a project
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Task Test Project' });
  projectId = projectRes.body.data.id;

  // Add member to the project
  await request(app)
    .post(`/api/projects/${projectId}/members`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email: 'taskmember@test.com' });
});

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.quit();
});

describe('Tasks API', () => {
  it('1. POST /api/tasks — owner creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: projectId, title: 'Fix the bug', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Fix the bug');
    expect(res.body.data.status).toBe('todo');

    taskId = res.body.data.id;
  });

  it('2. POST /api/tasks — member can also create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ project_id: projectId, title: 'Write tests', priority: 'medium' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('3. POST /api/tasks — returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ project_id: projectId, title: 'No auth task' });

    expect(res.status).toBe(401);
  });

  it('4. GET /api/tasks — returns 401 without token', async () => {
    const res = await request(app).get(`/api/tasks?project_id=${projectId}`);
    expect(res.status).toBe(401);
  });

  it('5. GET /api/tasks?project_id= — owner can list tasks with pagination', async () => {
    const res = await request(app)
      .get(`/api/tasks?project_id=${projectId}&page=1&limit=10`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('6. GET /api/tasks — filter by status', async () => {
    const res = await request(app)
      .get(`/api/tasks?project_id=${projectId}&status=todo`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { status: string }) => t.status === 'todo')).toBe(true);
  });

  // README required test case 7: PATCH /api/tasks/:id — member can update task status
  it('7. PATCH /api/tasks/:id — member can update task status', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('8. PATCH /api/tasks/:id — owner can update task details', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Fix the critical bug', priority: 'high', assigned_to: memberUserId });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Fix the critical bug');
    expect(res.body.data.assignee).toBeDefined();
  });

  // README required test case 8: DELETE /api/tasks/:id — member gets 403, owner gets 200
  it('9. DELETE /api/tasks/:id — member gets 403', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('10. DELETE /api/tasks/:id — owner gets 200', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Task deleted successfully');
  });

  it('11. GET /api/tasks — 400 if project_id is missing', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });

  it('12. POST /api/tasks — returns 400 if title is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ project_id: projectId });

    expect(res.status).toBe(400);
  });
});
