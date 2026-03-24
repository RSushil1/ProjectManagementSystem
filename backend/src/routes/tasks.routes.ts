import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller';

const router = Router();

router.use(authenticate);

const createTaskSchema = z.object({
  body: z.object({
    project_id: z.string().uuid('project_id must be a valid UUID'),
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assigned_to: z.string().uuid('assigned_to must be a valid UUID').optional().nullable(),
    due_date: z.string().optional().nullable()
  })
});

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    description: z.string().max(1000, 'Description too long').optional().nullable(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assigned_to: z.string().uuid('assigned_to must be a valid UUID').optional().nullable(),
    due_date: z.string().optional().nullable()
  })
});

const listTasksSchema = z.object({
  query: z.object({
    project_id: z.string().uuid('project_id must be a valid UUID'),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    page: z.string().regex(/^\d+$/, 'page must be a number').optional(),
    limit: z.string().regex(/^\d+$/, 'limit must be a number').optional()
  })
});

router.get('/', validate(listTasksSchema), listTasks);
router.post('/', validate(createTaskSchema), createTask);
router.patch('/:id', validate(updateTaskSchema), updateTask);
router.delete('/:id', deleteTask);

export default router;
