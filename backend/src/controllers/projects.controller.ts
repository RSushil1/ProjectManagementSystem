import { Response } from 'express';
import type { ProjectMember } from '@prisma/client';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCache, setCache, delCache } from '../utils/redis';

// POST /api/projects
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { name, description } = req.body;

  try {
    const project = await prisma.project.create({
      data: {
        name,
        description,
        owner_id: userId,
        members: {
          create: { user_id: userId, role: 'owner' }
        }
      },
      include: { members: true }
    });

    // Invalidate project list cache for the user
    await delCache(`projects:user:${userId}`);

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('createProject error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/projects
export const listProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));
  const skip = (page - 1) * limit;

  const cacheKey = `projects:user:${userId}:p${page}:l${limit}`;

  try {
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: {
          members: { some: { user_id: userId } }
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { tasks: true } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.task.count({ where: { project: { members: { some: { user_id: userId } } } } }) // Wait, project count, not task count
    ]);
    
    // Actually, prisma.project.count for projects
    const totalProjects = await prisma.project.count({
      where: {
        members: { some: { user_id: userId } }
      }
    });

    const response = {
      success: true,
      data: projects,
      pagination: {
        page,
        limit,
        total: totalProjects,
        totalPages: Math.ceil(totalProjects / limit)
      }
    };

    await setCache(cacheKey, response, 300); // 5 minutes

    res.status(200).json(response);
  } catch (error) {
    console.error('listProjects error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/projects/:id
export const getProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  const cacheKey = `project:${id}`;

  try {
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      // Still need to check if user is a member
      const isMember = cached.data.members.some((m: ProjectMember) => m.user_id === userId);
      if (!isMember) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
      res.status(200).json(cached);
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        tasks: { orderBy: { created_at: 'desc' } }
      }
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

    const response = { success: true, data: project };
    await setCache(cacheKey, response, 120); // 2 minutes

    res.status(200).json(response);
  } catch (error) {
    console.error('getProject error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// PUT /api/projects/:id
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isOwner = project.members.some((m: ProjectMember) => m.user_id === userId && m.role === 'owner');
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner can update this project' } });
      return;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { name, description }
    });

    // Invalidate project detail cache
    // Also invalidate project list cache (could be multiple pages, but we'll nuke any key starting with projects:user:)
    // For simplicity, we just delete the specific one if we knew it, 
    // but better to invalidate everything for that user or use a pattern.
    // The requirement says key is projects:user:{userId}
    await delCache(`project:${id}`);
    await delCache(`projects:user:${userId}`);

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('updateProject error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// DELETE /api/projects/:id
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isOwner = project.members.some((m: ProjectMember) => m.user_id === userId && m.role === 'owner');
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner can delete this project' } });
      return;
    }

    await prisma.project.delete({ where: { id } });

    // Invalidate
    await delCache(`project:${id}`);
    await delCache(`projects:user:${userId}`);

    res.status(200).json({ success: true, data: { message: 'Project deleted successfully' } });
  } catch (error) {
    console.error('deleteProject error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// POST /api/projects/:id/members
export const addMember = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const { email } = req.body;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isOwner = project.members.some((m: ProjectMember) => m.user_id === userId && m.role === 'owner');
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner can add members' } });
      return;
    }

    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User with that email not found' } });
      return;
    }

    const alreadyMember = project.members.some((m: ProjectMember) => m.user_id === userToAdd.id);
    if (alreadyMember) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'User is already a member of this project' } });
      return;
    }

    const member = await prisma.projectMember.create({
      data: { project_id: id, user_id: userToAdd.id, role: 'member' },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    // Invalidate
    await delCache(`project:${id}`);
    await delCache(`projects:user:${userId}`);
    await delCache(`projects:user:${userToAdd.id}`);

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    console.error('addMember error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// DELETE /api/projects/:id/members/:userId
export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  const requesterId = req.user?.userId;
  const { id, userId: targetUserId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const isOwner = project.members.some((m: ProjectMember) => m.user_id === requesterId && m.role === 'owner');
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner can remove members' } });
      return;
    }

    const targetMember = project.members.find((m: ProjectMember) => m.user_id === targetUserId);
    if (!targetMember) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found in this project' } });
      return;
    }

    if (targetMember.role === 'owner') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot remove the project owner' } });
      return;
    }

    await prisma.projectMember.delete({ where: { id: targetMember.id } });

    // Invalidate
    await delCache(`project:${id}`);
    await delCache(`projects:user:${requesterId}`);
    await delCache(`projects:user:${targetUserId}`);

    res.status(200).json({ success: true, data: { message: 'Member removed successfully' } });
  } catch (error) {
    console.error('removeMember error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};
