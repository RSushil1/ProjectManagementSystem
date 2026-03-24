import { Worker, Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import type { Task } from '@prisma/client';
import { prisma } from '../utils/db';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisHost = new URL(redisUrl).hostname;
const redisPort = parseInt(new URL(redisUrl).port || '6379', 10);

const workerConnection = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null as null
};

interface ExportJobData {
  exportId: string;
  projectId: string;
}

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function processExport(job: Job<ExportJobData>): Promise<void> {
  const { exportId, projectId } = job.data;

  // Mark as processing
  await prisma.export.update({
    where: { id: exportId },
    data: { status: 'processing' }
  });

  // Fetch project + tasks + assignees
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        include: { assignee: { select: { name: true } } },
        orderBy: { created_at: 'asc' }
      }
    }
  });

  if (!project) throw new Error(`Project ${projectId} not found`);

  // Build CSV content
  const lines: string[] = [];

  // Project section
  lines.push('PROJECT DETAILS');
  lines.push('Name,Description,Created At');
  lines.push([
    escapeCSV(project.name),
    escapeCSV(project.description),
    escapeCSV(project.created_at.toISOString())
  ].join(','));
  lines.push('');

  // Tasks section
  lines.push('TASKS');
  lines.push('Title,Status,Priority,Assignee,Due Date,Created At');
  for (const task of project.tasks) {
    lines.push([
      escapeCSV(task.title),
      escapeCSV(task.status),
      escapeCSV(task.priority),
      escapeCSV(task.assignee?.name),
      escapeCSV(task.due_date?.toISOString().split('T')[0]),
      escapeCSV(task.created_at.toISOString())
    ].join(','));
  }
  lines.push('');

  // Summary section
  const total = project.tasks.length;
  const byStatus = {
    todo: project.tasks.filter((t: Task) => t.status === 'todo').length,
    in_progress: project.tasks.filter((t: Task) => t.status === 'in_progress').length,
    done: project.tasks.filter((t: Task) => t.status === 'done').length
  };
  const byPriority = {
    low: project.tasks.filter((t: Task) => t.priority === 'low').length,
    medium: project.tasks.filter((t: Task) => t.priority === 'medium').length,
    high: project.tasks.filter((t: Task) => t.priority === 'high').length
  };

  lines.push('SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total Tasks,${total}`);
  lines.push(`Todo,${byStatus.todo}`);
  lines.push(`In Progress,${byStatus.in_progress}`);
  lines.push(`Done,${byStatus.done}`);
  lines.push(`Low Priority,${byPriority.low}`);
  lines.push(`Medium Priority,${byPriority.medium}`);
  lines.push(`High Priority,${byPriority.high}`);

  const csvContent = lines.join('\n');

  // Ensure /exports directory exists
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const filePath = path.join(exportsDir, `${exportId}.csv`);
  fs.writeFileSync(filePath, csvContent, 'utf-8');

  // Mark as completed
  await prisma.export.update({
    where: { id: exportId },
    data: {
      status: 'completed',
      file_path: filePath,
      completed_at: new Date()
    }
  });
}

export const exportWorker = new Worker<ExportJobData>(
  'exports',
  processExport,
  {
    connection: workerConnection,
    concurrency: 2
  }
);

exportWorker.on('failed', async (job, err) => {
  console.error(`Export job ${job?.id} failed:`, err.message);
  if (job?.data?.exportId) {
    try {
      await prisma.export.update({
        where: { id: job.data.exportId },
        data: { status: 'failed' }
      });
    } catch (dbErr) {
      console.error('Could not update export status to failed:', dbErr);
    }
  }
});

exportWorker.on('completed', (job) => {
  console.log(`Export job ${job.id} completed for export ${job.data.exportId}`);
});
