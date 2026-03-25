# System Design Document

This document outlines the architectural decisions, database schema, state management strategy, asynchronous processing implementations, and technical trade-offs made during the development of the Full-Stack Project Management System.

## Architecture Overview

The application is built using a modern, scalable **TypeScript-first** stack to ensure end-to-end type safety, robust performance, and excellent developer experience.

### Backend Stack
- **Node.js & Express**: Chosen for its lightweight footprint and massive ecosystem.
- **TypeScript**: Provides static typing, catching compilation errors early and enforcing contract synchronization between the DB and API.
- **Prisma ORM**: A modern database toolkit that enables type-safe queries and straightforward schema migrations.
- **PostgreSQL**: A highly reliable, relational database ideal for modeling complex entities like users, projects, team memberships, and tasks.
- **Redis (ioredis)**: Serves two critical roles: caching frequently accessed data (Cache-Aside pattern) and acting as the message broker for background job queues.
- **BullMQ**: A robust queue system built on top of Redis for handling asynchronous background tasks (like CSV exports).

### Frontend Stack
- **React 18 & Vite**: Offers rapid hot-module reloading and optimized production builds.
- **TypeScript**: Ensures UI components adhere strictly to the API response contracts.
- **Tailwind CSS v4**: A utility-first CSS framework used to build a highly responsive, glassmorphic, and aesthetically premium user interface quickly.
- **@dnd-kit/core**: A heavily customizable and accessible drag-and-drop toolkit utilized for the interactive Kanban board.

---

## Database Schema

The database relies on a normalized relational model emphasizing strict referential integrity.

1. **User**: Represents the authentication entity. Stores `id`, `name`, `email`, and hashed `password`. A User can be part of multiple projects and be assigned multiple tasks.
2. **Project**: The central organizational workspace (`id`, `name`, `description`). It acts as the anchor for tasks and members.
3. **ProjectMember**: A many-to-many junction table linking `User` and `Project`. It includes a role enum (`owner` or `member`) to implement Role-Based Access Control (RBAC). 
4. **Task**: Represents actionable items within a project (`id`, `title`, `description`, `status`, `priority`, `due_date`). It maintains foreign keys pointing to its parent `Project` and (optionally) an `assignee` (`User`).
5. **Export**: Tracks the asynchronous CSV generation job (`id`, `status` [pending, processing, completed, failed], `file_path`). Tied to the `Project` being exported and the `User` who requested it.

*All primary keys utilize UUIDs to mask data sequentiality and prevent predictable ID scraping.*

---

## State Management Decisions

### Server-State: TanStack Query (React Query)
We elected to use **TanStack Query** to manage the vast majority of our frontend state.
- **Why**: The application's core functionality relies on reflecting server-side database records (projects, tasks, exports). TanStack Query provides out-of-the-box caching, background fetching, pagination support, and deduplication.
- **Optimistic UI Updates**: TanStack query's `onMutate` architecture is heavily utilized in the Drag-and-Drop Kanban Board. Task drops immediately mutate the cache to visually shift columns without waiting for the server, rolling back automatically if the `PATCH` request fails.

### Global Client-State: React Context
We used basic **React Context** (`AuthContext`) strictly for global authentication state (current user payload, login/logout execution flags). Using heavy external libraries like Redux would have been absolute overkill for simple token-based JWT orchestration.

---

## Queue & Worker Design 

Generating a CSV export requires parsing relational data, formatting, and file I/O operations which can block the main Node.js event loop if done synchronously. To prevent blocking the API for other users:

1. **Producer (The API)**: When the `POST /api/projects/:id/export` endpoint is hit, the application creates an `Export` record in the database marked as `pending`. It then injects a job into the **BullMQ** queue (`exportQueue`) containing the `exportId` and `projectId`, and immediately returns a `202 Accepted` response to the client.
2. **Message Broker**: **Redis** efficiently holds the job queue, tracking delayed, active, and completed jobs.
3. **Consumer (Worker)**: A dedicated BullMQ Worker listens to `exportQueue`. It picks up the task, sets the status to `processing`, aggregates the Project and Task records from PostgreSQL, streams them into a `.csv` file in the `/exports` directory, sets the database row to `completed` and attaches the local `file_path`.
4. **Client Polling**: The frontend uses TanStack Query's `refetchInterval` to poll the status endpoint every 3 seconds. Once it reads "completed", polling ceases, and a download prompt is cleanly served to the user.

---

## Technical Trade-Offs

Given the tight timeline constraints, deliberate architectural trade-offs were made:

### 1. Polling vs. WebSockets for Job Completion
- **The Trade-off**: I implemented HTTP Polling (one request every 3 seconds) instead of a real-time WebSocket/Server-Sent-Events (SSE) implementation to notify the client when the CSV is ready.
- **The Rationale**: While WebSockets are highly efficient for real-time pushing, they require complex connection lifecycle handling, heartbeats, scaling configurations, and token validation. Polling with TanStack Query took four lines of code and provides "good enough" real-time responsiveness for sparse background jobs while keeping infrastructure stateless.

### 2. Controller-Level Authorization vs. Middleware Libraries
- **The Trade-off**: Role-Based Access Control (RBAC) was enforced procedurally inside individual controllers (e.g., manually verifying `isOwner` by querying `ProjectMember` records and throwing 403s), rather than implementing a holistic permission middleware like *CASL* or creating expansive custom decorator logic.
- **The Rationale**: This approach inherently repeats a small amount of verification logic (`findMemership(...) => if role !== 'owner' throw`). However, setting up a complex Policy-Based middleware requires large abstraction overhead. The procedural approach, while somewhat repetitive, is extremely explicit, easy to read, and predictable for this project's scope.
