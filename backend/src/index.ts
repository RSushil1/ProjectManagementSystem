import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

import authRouter from './routes/auth.routes';
import projectsRouter from './routes/projects.routes';
import tasksRouter from './routes/tasks.routes';
import exportsRouter from './routes/exports.routes';

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/exports', exportsRouter);

if (process.env.NODE_ENV !== 'test') {
  // Start the BullMQ worker only outside test environment
  // to avoid persistent Redis connections during Jest runs
  require('./jobs/exportWorker');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
