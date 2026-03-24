import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

export default async () => {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
  process.env.NODE_ENV = 'test';
  
  console.log('\nConfiguring test database...');
  execSync('npx prisma db push --accept-data-loss', { 
    env: { ...process.env }, 
    stdio: 'inherit' 
  });
};
