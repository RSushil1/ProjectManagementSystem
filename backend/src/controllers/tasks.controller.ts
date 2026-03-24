import { Response } from 'express';
import type { ProjectMember } from '@prisma/client';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { delCache } from '../utils/redis';

// GET /api/tasks?project_id=&status=&priority=&page=&limit=
export const listTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { project_id, status, priority } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));
  const skip = (page - 1) * limit;

  try {
    // Must have project_id — user must be a member of that project
    if (!project_id) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'project_id query param is required' } });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isMember = project.members.some((m: ProjectMember) => m.user_id === userId);
    if (!isMember) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const where: Record<string, unknown> = { project_id };
    if (status) where['status'] = status;
    if (priority) where['priority'] = priority;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { assignee: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.task.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('listTasks error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// POST /api/tasks
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { project_id, title, description, priority, assigned_to, due_date } = req.body;

  try {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isMember = project.members.some((m: ProjectMember) => m.user_id === userId);
    if (!isMember) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // If assigned_to is given, that user must also be a member
    if (assigned_to) {
      const isAssigneeMember = project.members.some((m: ProjectMember) => m.user_id === assigned_to);
      if (!isAssigneeMember) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Assignee must be a member of the project' } });
        return;
      }
    }

    const task = await prisma.task.create({
      data: {
        project_id,
        title,
        description,
        priority: priority || 'medium',
        assigned_to: assigned_to || null,
        due_date: due_date ? new Date(due_date) : null
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });
    
    // Invalidate project detail cache
    await delCache(`project:${project_id}`);

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('createTask error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// PATCH /api/tasks/:id
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const { title, description, status, priority, assigned_to, due_date } = req.body;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { include: { members: true } } }
    });

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const isMember = task.project.members.some((m: ProjectMember) => m.user_id === userId);
    if (!isMember) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // If reassigning, validate new assignee is a project member
    if (assigned_to !== undefined && assigned_to !== null) {
      const isAssigneeMember = task.project.members.some((m: ProjectMember) => m.user_id === assigned_to);
      if (!isAssigneeMember) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Assignee must be a member of the project' } });
        return;
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigned_to !== undefined && { assigned_to: assigned_to || null }),
        ...(due_date !== undefined && { due_date: due_date ? new Date(due_date) : null })
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });

    // Invalidate project detail cache
    await delCache(`project:${task.project_id}`);

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('updateTask error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// DELETE /api/tasks/:id  — owner only
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { include: { members: true } } }
    });

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const isMember = task.project.members.some((m: ProjectMember) => m.user_id === userId);
    if (!isMember) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const isOwner = task.project.members.some((m: ProjectMember) => m.user_id === userId && m.role === 'owner');
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner can delete tasks' } });
      return;
    }

    await prisma.task.delete({ where: { id } });

    // Invalidate project detail cache
    await delCache(`project:${task.project_id}`);

    res.status(200).json({ success: true, data: { message: 'Task deleted successfully' } });
  } catch (error) {
    console.error('deleteTask error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};
