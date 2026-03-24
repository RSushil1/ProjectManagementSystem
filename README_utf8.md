# Aptech Solutions — Full-Stack Developer Assessment

**Position:** Full-Stack Developer (4+ Years Experience)
**Location:** Surat — Work From Office
**Time Limit:** 12 hours (actual working time)
**Submission Deadline:** Within 3 days from the date of assignment
**Submission:** GitHub repository (public, or invite `iaptechsolutions` if private)

---

## Overview

Build a **Project & Task Management System** with role-based access, background processing, caching, and export functionality. This assessment evaluates your ability to build production-quality full-stack applications using our core tech stack.

We are not just looking at whether it works — we are reviewing your code structure, your decision-making, and how you handle real-world concerns like security, failure states, and data consistency.

---

## Tech Stack Requirements

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Backend        | Node.js, Express, TypeScript       |
| Database       | PostgreSQL                         |
| Cache & Queue  | Redis, Bull/BullMQ                 |
| Frontend       | React 18+, TypeScript, TailwindCSS |
| Auth           | JWT (access + refresh token)       |
| Testing        | Jest + Supertest                   |
| Infrastructure | Docker + docker-compose            |

---

## Part 1: Backend

### Database Schema

Design and implement the following schema using migrations (Prisma / TypeORM / Knex — your choice):

```
users
├── id (uuid, primary key)
├── name (string)
├── email (string, unique)
├── password_hash (string)
└── created_at (timestamp)

projects
├── id (uuid, primary key)
├── name (string)
├── description (text, nullable)
├── owner_id (uuid, foreign key → users)
└── created_at (timestamp)

project_members
├── id (uuid, primary key)
├── project_id (uuid, foreign key → projects)
├── user_id (uuid, foreign key → users)
├── role (enum: owner, member)
└── joined_at (timestamp)

tasks
├── id (uuid, primary key)
├── project_id (uuid, foreign key → projects)
├── title (string)
├── description (text, nullable)
├── status (enum: todo, in_progress, done)
├── priority (enum: low, medium, high)
├── assigned_to (uuid, foreign key → users, nullable)
├── due_date (date, nullable)
└── created_at (timestamp)

exports
├── id (uuid, primary key)
├── project_id (uuid, foreign key → projects)
├── user_id (uuid, foreign key → users)
├── status (enum: pending, processing, completed, failed)
├── file_path (string, nullable)
├── created_at (timestamp)
└── completed_at (timestamp, nullable)
```

---

### API Endpoints

#### Authentication

| Method | Endpoint             | Description                                  |
| ------ | -------------------- | -------------------------------------------- |
| POST   | `/api/auth/register` | Register new user                            |
| POST   | `/api/auth/login`    | Login — returns access token + refresh token |
| POST   | `/api/auth/refresh`  | Exchange refresh token for new access token  |
| POST   | `/api/auth/logout`   | Invalidate refresh token                     |

> **Access token TTL:** 15 minutes
> **Refresh token TTL:** 7 days — store issued tokens server-side (Redis or DB) for invalidation support

#### Projects (Protected)

| Method | Endpoint                            | Description                                                   |
| ------ | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/projects`                     | List projects user owns or is a member of (cached, paginated) |
| POST   | `/api/projects`                     | Create new project                                            |
| GET    | `/api/projects/:id`                 | Get project with all tasks (cached)                           |
| POST   | `/api/projects/:id/members`         | Add a member to the project (owner only)                      |
| DELETE | `/api/projects/:id/members/:userId` | Remove a member from the project (owner only)                 |

#### Tasks (Protected)

| Method | Endpoint         | Description                                                                         |
| ------ | ---------------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/tasks`     | List tasks — supports `?project_id=`, `?status=`, `?priority=`, `?page=`, `?limit=` |
| POST   | `/api/tasks`     | Create task (owner or member)                                                       |
| PATCH  | `/api/tasks/:id` | Update task — status, assignment, details (owner or member)                         |
| DELETE | `/api/tasks/:id` | Delete task (owner only)                                                            |

#### Export (Protected, Queue-Based)

| Method | Endpoint                   | Description                                        |
| ------ | -------------------------- | -------------------------------------------------- |
| POST   | `/api/projects/:id/export` | Trigger export job — returns export ID immediately |
| GET    | `/api/exports/:id`         | Check export status, return download link if ready |
| GET    | `/api/exports`             | List current user's export history                 |

---

### Implementation Requirements

#### 1. Access Control (RBAC)

- A user can only access projects they **own** or are a **member** of.
- **Owner** can: create/update/delete tasks, add/remove members, trigger exports.
- **Member** can: view the project, create tasks, update tasks. Cannot delete tasks or manage members.
- Accessing a project or task that does not belong to the user must return `403 Forbidden` — **not** `404`.

#### 2. Authentication — Access + Refresh Token Flow

- On login, issue:
  - A **short-lived access token** (JWT, 15 min TTL) returned in the response body
  - A **refresh token** (opaque or JWT, 7 day TTL) — store issued tokens server-side (Redis or DB) for invalidation support
- `POST /api/auth/refresh` accepts a valid refresh token and returns a new access token
- `POST /api/auth/logout` invalidates the refresh token so it cannot be reused
- Protected routes consume the access token via `Authorization: Bearer <token>` header

#### 3. Rate Limiting

Apply rate limiting on auth endpoints using `express-rate-limit` or equivalent:

| Endpoint                  | Limit                             |
| ------------------------- | --------------------------------- |
| `POST /api/auth/login`    | 10 requests per 15 minutes per IP |
| `POST /api/auth/register` | 5 requests per hour per IP        |
| `POST /api/auth/refresh`  | 20 requests per 15 minutes per IP |

Return a `429` status with a standard error envelope when the limit is exceeded.

#### 4. Job Queue (Bull + Redis)

Implement background export processing:

- When `POST /api/projects/:id/export` is called:
  1. Create an `exports` record with status `pending`
  2. Add job to Bull queue
  3. Return the export ID **immediately** — do not block the request

- Queue worker must:
  1. Update status → `processing`
  2. Fetch project and all associated tasks
  3. Generate a **CSV** file containing:
     - Project details: name, description, created date
     - All tasks: title, status, priority, assignee name, due date, created date
     - Summary section: total tasks, count by status, count by priority
  4. Save file to `/exports/{exportId}.csv`
  5. Update record: `status = completed`, `file_path = path`, `completed_at = now()`
  6. On any error: `status = failed`

- Implement **automatic retry** — failed jobs must retry up to **2 times** with a backoff delay before being marked `failed`. Document how retries are configured in `DESIGN.md`.

#### 5. Caching (Redis — Cache-Aside Pattern)

| Data                | Cache Key Pattern        | TTL       |
| ------------------- | ------------------------ | --------- |
| User's project list | `projects:user:{userId}` | 5 minutes |
| Project with tasks  | `project:{projectId}`    | 2 minutes |

Cache invalidation rules:

| Event                            | Invalidate                                      |
| -------------------------------- | ----------------------------------------------- |
| Project created                  | `projects:user:{userId}`                        |
| Task created / updated / deleted | `project:{projectId}`                           |
| Member added / removed           | `project:{projectId}`, `projects:user:{userId}` |

#### 6. Pagination & Filtering

- `GET /api/projects` — supports `?page=1&limit=10` (default limit: 10, max: 50)
- `GET /api/tasks?project_id=` — supports `?status=`, `?priority=`, `?page=`, `?limit=`
- All list responses must follow this envelope:

  ```json
  {
    "success": true,
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5
    }
  }
  ```

#### 7. Code Quality Requirements

- TypeScript with `strict: true` throughout — no use of `any`
- Input validation using **Zod** (recommended) or Joi on all request bodies and query params
- Consistent error response format:

  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable description"
    }
  }
  ```

- JWT middleware applied to all protected routes
- Proper HTTP status codes — `200`, `201`, `400`, `401`, `403`, `404`, `422`, `429`, `500`

---

## Part 2: Frontend

### Pages & Features

#### 1. Authentication Pages

- **Login Page:** Email + password form with error display
- **Register Page:** Name, email, password form with error display
- Redirect to dashboard after successful auth
- Implement an **Axios interceptor** that:
  - Attaches the access token to every outgoing request
  - On receiving a `401`, automatically calls `POST /api/auth/refresh` to get a new access token
  - Retries the original failed request once with the new token
  - If the refresh call also fails, clears all tokens and redirects to the login page

#### 2. Dashboard Page

- Display list of projects the user owns or is a member of
- Each project card shows: project name, member count, task count, created date, role badge (Owner / Member)
- "New Project" button — opens a modal form
- Click on a project → navigate to project detail page
- Paginate the project list if there are more than 10 projects

#### 3. Project Detail Page

- **Header:** Project name, description, member avatars/names, "Export" button
- **Add Member** (owner only): Input field to add a user by email — calls `POST /api/projects/:id/members`
- **Kanban Board:**
  - Three columns: **To Do**, **In Progress**, **Done**
  - Tasks rendered as cards within their respective status column showing: title, priority badge, assignee name, due date
  - Drag a card from one column to another — calls `PATCH /api/tasks/:id` to update the task status
  - Dragging must use **optimistic updates** via TanStack Query's `onMutate` / `onError` / `onSettled` — the UI updates immediately and rolls back with an error toast if the API call fails
  - Implement using `@dnd-kit/core` or `react-beautiful-dnd`
- **Filter bar:** Filter visible tasks by priority (All / Low / Medium / High)
- **Add Task button** — opens a modal form with: title, description, priority (select), assignee (select from project members), due date

#### 4. Export Feature

- "Export Project" button in the project header
- On click:
  - Call `POST /api/projects/:id/export`
  - Button changes to "Exporting..." with a spinner — disabled while polling
  - Poll `GET /api/exports/:id` every 3 seconds using TanStack Query's `refetchInterval`
  - When `status === completed`: stop polling, show a "Download CSV" link
  - When `status === failed`: stop polling, show an error toast
- Show a collapsible export history section listing all past exports for the project (status, date, download link if available)

---

### Technical Requirements

- **React 18+** with functional components and hooks only
- **TypeScript** throughout — no `any` types
- **TailwindCSS** for all styling — do not use any component libraries (MUI, Chakra, Radix, etc.)
- **TanStack Query** for all server state management — no raw `useEffect` + `fetch` for data fetching anywhere in the codebase
- All data fetching must be encapsulated in **named custom hooks** — no `useQuery` or `useMutation` calls directly inside page or component files. Examples: `useProjects()`, `useProject(id)`, `useTasks(projectId, filters)`, `useExportStatus(exportId)`
- Define all API response shapes in a single `types/api.ts` file — every hook, service, and component must use these types. No inline type definitions for API data.
- Proper loading states — skeletons or spinners on all async content
- Proper error states with user-facing messages on all async content
- Basic responsive design — works correctly on desktop and tablet viewports

---

## Part 3: Tests

Write integration tests for the backend using **Jest + Supertest**.

You must cover all of the following scenarios:

| #   | Test Case                                                                     |
| --- | ----------------------------------------------------------------------------- |
| 1   | `POST /api/auth/register` — registers a new user successfully                 |
| 2   | `POST /api/auth/login` — returns access + refresh tokens on valid credentials |
| 3   | `POST /api/auth/login` — returns `401` on wrong password                      |
| 4   | `GET /api/projects` — returns `401` when no token is provided                 |
| 5   | `POST /api/projects` — creates a project for an authenticated user            |
| 6   | `GET /api/projects/:id` — returns `403` when accessed by a non-member         |
| 7   | `PATCH /api/tasks/:id` — member can update task status                        |
| 8   | `DELETE /api/tasks/:id` — member gets `403`, owner gets `200`                 |

Use a **separate test database** — configure via environment variables. Tests must be runnable with a single `npm run test` command from the backend directory.

---

## Part 4: Infrastructure

Provide a `docker-compose.yml` in the repository root that:

- Spins up **PostgreSQL**
- Spins up **Redis**
- Spins up the **backend** with hot reload
- Exposes the backend on port `4000`
- Reads all secrets from a `.env` file (provide `.env.example`)

The reviewer must be able to run `docker-compose up` and have the full backend environment running with zero manual steps.

The frontend does not need to be containerised — running it with `npm run dev` after the compose stack is up is sufficient.

---

## Part 5: System Design Document (`DESIGN.md`)

Create a `DESIGN.md` in the repository root. One focused paragraph per question.

1. **Caching Strategy:** How does your cache invalidation work? What happens if the cache and database fall out of sync — how does TTL help, and what are its limits?

2. **Failure Handling:** What happens if an export job fails halfway through? How does BullMQ's retry mechanism work in your implementation, and what would you add to make failures more observable in production?

3. **Access Control:** How did you enforce RBAC? Where does the ownership/membership check live — middleware, service layer, or controller — and why?

4. **Scale:** If this system needed to support 10,000 concurrent users, what are the first two bottlenecks you would address in your current implementation, and how?

---

## Submission Checklist

- [ ] GitHub repository (public, or invite `iaptechsolutions` if private)
- [ ] `docker-compose.yml` — full backend stack spins up with one command
- [ ] `.env.example` with all required environment variables documented
- [ ] `README.md` containing:
  - Setup and run instructions (Docker + local frontend)
  - All environment variables explained
  - **Key Decisions section** — 5–8 bullet points on meaningful technical choices you made and why (token storage approach, caching design, RBAC structure, anything you skipped and why)
  - Known limitations or incomplete sections
- [ ] `DESIGN.md` answering all four system design questions
- [ ] `postman_collection.json` (or Bruno equivalent) committed to the repo root — must cover all API endpoints with example request bodies and expected responses
- [ ] Clean Git history with meaningful, incremental commit messages

---

## Recommended Project Structure

```
project-root/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/           # or prisma/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── jobs/             # BullMQ workers
│   │   ├── utils/
│   │   └── index.ts
│   ├── exports/              # Generated CSV files
│   ├── tests/                # Jest + Supertest integration tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/            # All custom data hooks live here
│   │   ├── services/         # Axios instance + interceptor
│   │   ├── types/
│   │   │   └── api.ts        # All API response type definitions
│   │   └── App.tsx
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── postman_collection.json
├── DESIGN.md
├── README.md
└── .env.example
```

---

## Important Notes

- **Commit frequently** with meaningful messages. We read your Git history as a signal for how you work, not just the final output.
- **AI tools are allowed** (Copilot, ChatGPT, Claude) — but be prepared to explain every line of your code in a follow-up technical interview. We will ask.
- **If you get stuck**, document the blocker in your README and move on. Clean, partial work is valued over rushed, broken work.
- **Do not over-engineer.** Readable, practical code beats clever abstractions.
- **The Key Decisions section matters.** This is where we see how you think, not just what you built.

---

## Questions?

Email **<info@aptechsolutions.io>** with subject line: `Full-Stack Assessment Question`

---

**Good luck. We look forward to reviewing your submission.**

— Aptech Solutions
