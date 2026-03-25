# Full-Stack Project Management System

**Developer:** Sushil Singh Rathore (Sushil)  
**Email:** sushilsinghrathore1998@gmail.com (Sample)

## Overview
A comprehensive, full-stack project management application built with a modern stack featuring secure authentication, paginated dashboards, Kanban drag-and-drop task management, and asynchronous background worker processing for CSV exports.

## Core Technologies
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS v4, TanStack Query, @dnd-kit/core
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Caching & Queues**: Redis, BullMQ
- **Authentication**: Stateful JWTs (Access & Refresh tokens) with secure memory scaling and localstorage persisting.

---

## ⚡ Setup & Starting the Application

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- Node.js (v18+)
- Postgres (or Docker to run Postgres)
- Redis

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory using the provided `.env.example`:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_manager?schema=public"
JWT_SECRET="supersecret_jwt_key_here"
REFRESH_TOKEN_SECRET="supersecret_refresh_key_here"
REDIS_URL="redis://localhost:6379"
FRONTEND_URL="http://localhost:5173"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_manager_test?schema=public"
```

Create a `.env` file in the `frontend/` directory (if not exists):
```env
VITE_API_URL="http://localhost:4000/api"
```

### 3. Spin up Redis and Database
You can use Docker to spin up Redis and PostgreSQL locally:
```bash
docker run --name my-redis -p 6379:6379 -d redis
docker run --name my-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### 4. Running the Backend
Navigate to the `backend/` directory and install dependencies:
```bash
cd backend
npm install
```

Run database migrations to initialize tables:
```bash
npx prisma migrate dev --name init
```

Start the backend development server and BullMQ worker:
```bash
npm run dev
```

### 5. Running the Frontend
In a new terminal, navigate to the `frontend/` directory:
```bash
cd frontend
npm install
npm run dev
```

The app will be running at [http://localhost:5173](http://localhost:5173).

---

## 🏗️ Architecture & Features 

- **State Management**: Uses TanStack Query for optimal server-side state synchronization, background fetching, and optimistic UI updates (e.g., Drag & Drop). 
- **Queue/Worker Pattern**: Offloads expensive CSV export generation tasks using **BullMQ + Redis**, ensuring the main Node.js event pool is never blocked, enhancing horizontal scalability.
- **RBAC Security**: Validates endpoint access depending on `owner` or `member` project designations directly inside Express controllers.
- **Optimized SQL Retrieval**: Utilizes Prisma ORM with select clauses to calculate relation boundaries (like counts) securely.

See the `DESIGN.md` in the root of the project for in-depth explanations on Database Architecture, Technical Trade-offs, and state management specifics.

---

## 🧪 Testing

The backend is fully integration tested using **Jest** and **Supertest** ensuring all primary routes (Registration, Secure Task Modification, Authentication checks) act predictably. 
Test database execution is handled automatically. 

To execute all tests, navigate into the `backend/` directory:
```bash
npm run test
```

## 📩 API Documentation (Postman)

A comprehensive API collection `postman_collection.json` export is available in the root of this project. It covers all 19 functional API endpoints formatted into categories (`Auth`, `Projects`, `Tasks`, `Exports`). Import it directly into Postman to interface sequentially.
