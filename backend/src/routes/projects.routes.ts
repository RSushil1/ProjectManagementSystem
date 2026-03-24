import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember
} from '../controllers/projects.controller';

const router = Router();

// All project routes require authentication
router.use(authenticate);

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
    description: z.string().max(500, 'Description too long').optional()
  })
});

const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
    description: z.string().max(500, 'Description too long').optional()
  })
});

const addMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address')
  })
});

router.post('/', validate(createProjectSchema), createProject);
router.get('/', listProjects);
router.get('/:id', getProject);
router.put('/:id', validate(updateProjectSchema), updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/members', validate(addMemberSchema), addMember);
router.delete('/:id/members/:userId', removeMember);

export default router;
