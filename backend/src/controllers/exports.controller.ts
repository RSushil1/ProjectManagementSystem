import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/db';
import { exportQueue } from '../jobs/exportQueue';
import { AuthRequest } from '../middlewares/auth.middleware';
import type { ProjectMember } from '@prisma/client';

// POST /api/projects/:id/export
export const triggerExport = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id: projectId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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

    // Create export record with pending status
    const exportRecord = await prisma.export.create({
      data: { project_id: projectId, user_id: userId!, status: 'pending' }
    });

    // Enqueue the job — non-blocking, returns immediately
    await exportQueue.add('generate-csv', {
      exportId: exportRecord.id,
      projectId
    });

    res.status(202).json({ success: true, data: { exportId: exportRecord.id, status: 'pending' } });
  } catch (error) {
    console.error('triggerExport error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/exports/:id — check status, return download link if ready
export const getExportStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  try {
    const exportRecord = await prisma.export.findUnique({ where: { id } });

    if (!exportRecord) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    if (exportRecord.user_id !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const data: Record<string, unknown> = {
      id: exportRecord.id,
      project_id: exportRecord.project_id,
      status: exportRecord.status,
      created_at: exportRecord.created_at,
      completed_at: exportRecord.completed_at
    };

    if (exportRecord.status === 'completed' && exportRecord.file_path) {
      data['download_url'] = `/api/exports/${id}/download`;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getExportStatus error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/exports — list current user's export history
export const listExports = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));
  const skip = (page - 1) * limit;

  try {
    const [exports, total] = await Promise.all([
      prisma.export.findMany({
        where: { user_id: userId },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.export.count({ where: { user_id: userId } })
    ]);

    const data = exports.map((e: { id: string; status: string; file_path: string | null; project: { id: string; name: string }; created_at: Date; completed_at: Date | null; project_id: string; user_id: string }) => ({
      ...e,
      download_url: e.status === 'completed' && e.file_path ? `/api/exports/${e.id}/download` : null
    }));

    res.status(200).json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('listExports error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};

// GET /api/exports/:id/download — stream the CSV file
export const downloadExport = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { id } = req.params;

  try {
    const exportRecord = await prisma.export.findUnique({ where: { id } });

    if (!exportRecord) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Export not found' } });
      return;
    }

    if (exportRecord.user_id !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (exportRecord.status !== 'completed' || !exportRecord.file_path) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Export is not ready for download' } });
      return;
    }

    if (!fs.existsSync(exportRecord.file_path)) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Export file not found on disk' } });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="export-${id}.csv"`);
    fs.createReadStream(exportRecord.file_path).pipe(res);
  } catch (error) {
    console.error('downloadExport error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal Server Error' } });
  }
};
