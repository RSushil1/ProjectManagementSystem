import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getExportStatus, listExports, downloadExport } from '../controllers/exports.controller';

const router = Router();

router.use(authenticate);

router.get('/', listExports);
router.get('/:id', getExportStatus);
router.get('/:id/download', downloadExport);

export default router;
