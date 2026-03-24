import { Response } from 'express';
import type { ProjectMember } from '@prisma/client';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middlewares/auth.middleware';

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

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('createProject error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/projects
export const listProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  try {
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { user_id: userId } }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    console.error('listProjects error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/projects/:id
export const getProject = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  try {
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

    res.status(200).json({ success: true, data: project });
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

    res.status(200).json({ success: true, data: { message: 'Member removed successfully' } });
  } catch (error) {
    console.error('removeMember error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};
