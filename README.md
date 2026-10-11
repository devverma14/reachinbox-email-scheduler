# ReachInbox — Email Scheduling & Dispatch System

A production-minded, full-stack email scheduling and dispatch system built for high-reliability cold outreach campaigns. Features delayed job execution with **BullMQ**, persistent relational storage in **PostgreSQL** via **Prisma ORM**, **Redis-backed Rate Limiting** with automatic hourly window rescheduling, **Ethereal SMTP** test delivery with live message preview links, **Elasticsearch** full-text search indexing, **Slack OAuth** alerting, and a protected **Bull Board** queue dashboard.

> **Primary Tagline**: *Schedule smarter. Reach every inbox at the right time.*

---

## 🌟 Key Features

1. **Email Scheduling & Staggered Send Delays**:
   - Schedule bulk email outreach campaigns with specific future start times (`scheduledAt`).
   - Configurable minimum send interval (`delayBetweenSendsMs`) between lead emails to mirror organic human sending behavior.
   - Drag-and-drop CSV lead file parsing with automatic email address validation.

2. **Redis-Backed Rate Limiting & Automatic Rescheduling Engine**:
   - Configurable hourly sending limits per sender (`hourlyLimit`).
   - Atomic Redis counter windowing prevents concurrency race conditions across multiple worker instances.
   - When a sender reaches their hourly limit, remaining jobs are automatically rescheduled to the start of the next hourly window instead of being dropped.
   - Triggers real-time **Slack OAuth alerts** to connected Slack channels when limits are exceeded.

3. **Reliability, Isolation & Idempotency**:
   - Idempotent Job IDs (`email-<logId>`) prevent duplicate job creation.
   - Startup reconciliation mechanism (`reconcileOrphanedJobs`) automatically re-enqueues pending database records into BullMQ on server or worker restarts.
   - Atomic state transitions (`SCHEDULED` ➔ `PROCESSING` ➔ `SENT` / `FAILED` / `RESCHEDULED`).
   - Isolated per-session Demo Workspace identities with seamless Google Account linking.

4. **Elasticsearch Full-Text Search**:
   - Automatic indexing of scheduled and sent email documents in Elasticsearch (`reachinbox_emails`).
   - Instant search across subject lines, body content, and recipient email addresses with fallback query capabilities.

5. **Protected Bull Board Queue Dashboard**:
   - Real-time visibility into active, delayed, completed, and failed BullMQ jobs at `/admin/queues` with admin authentication safeguards.

---

## 🏗 System Architecture

```
                                  ┌───────────────────────────┐
                                  │   React + Tailwind UI     │
                                  │   (Vite / TypeScript)     │
                                  └─────────────┬─────────────┘
                                                │ REST API
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Express API Server                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ Auth & Google    │  │ Email Scheduler  │  │ Slack OAuth     │  │ Bull Board     │  │
│  │ Account Linking  │  │ (/api/emails)    │  │ Integration     │  │ (/admin/queues)│  │
│  └──────────────────┘  └────────┬─────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────┼──────────────────────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │ PostgreSQL +     │          │  Elasticsearch   │
        │ Prisma ORM       │          │  Search Index    │
        └──────────────────┘          └──────────────────┘
                                                 ▲
                                                 │ Async Indexing
                                                 │
┌────────────────────────────────────────────────┴───────────────────────────────────────┐
│                                BullMQ Worker Engine                                    │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────────┐  │
│  │ Atomic Redis Counter │  │ Nodemailer + Ethereal   │  │ Slack WebAPI Alerting     │  │
│  │ (Rate Limiter)       │  │ SMTP Transporter        │  │ (Rate Limit Warnings)     │  │
│  └──────────────────────┘  └─────────────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, Axios, PapaParse.
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, Passport.js.
- **Queue & Cache**: BullMQ, Redis 7 (ioredis).
- **Database**: PostgreSQL 15.
- **Search**: Elasticsearch 8.x (`@elastic/elasticsearch`).
- **Email**: Nodemailer + Ethereal Test SMTP.
- **Alerts & Auth**: Slack Web API (`@slack/web-api`), Google OAuth2.0 (Passport Google Strategy).
- **Monitoring**: Bull Board Express Adapter (`@bull-board/express`).

---

## 🚀 Quick Start & Local Setup Guide

### Prerequisites
- Node.js >= 18.x
- Docker & Docker Compose (for PostgreSQL, Redis, Elasticsearch)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/devverma14/reachinbox-email-scheduler.git
cd reachinbox-email-scheduler

# Install backend and frontend dependencies
npm run setup
```

### 2. Start Infrastructure Services (Docker)
```bash
docker-compose up -d
```
This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`
- **Elasticsearch** on `localhost:9200`

### 3. Setup Environment Variables
Copy `.env.example` into `backend/.env`:
```bash
cp .env.example backend/.env
```

### 4. Run Database Migrations
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start Backend, Worker & Frontend
Open separate terminal windows or run scripts:

**Terminal 1 (Backend API Server)**:
```bash
cd backend
npm run dev
```

**Terminal 2 (BullMQ Worker Engine)**:
```bash
cd backend
npm run dev:worker
```

**Terminal 3 (Vite Frontend)**:
```bash
cd frontend
npm run dev
```

Access the UI at: **`http://localhost:3000`**  
Access Bull Board at: **`http://localhost:4000/admin/queues`**

---

## ⚙️ Environment Configuration (`backend/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Backend API port |
| `CLIENT_URL` | `http://localhost:3000` | Frontend web app URL |
| `SERVER_URL` | `http://localhost:4000` | Backend server base URL |
| `DATABASE_URL` | `postgresql://reachinbox:reachinbox_secret_password@localhost:5432/reachinbox_db` | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL |
| `GOOGLE_CLIENT_ID` | `...` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `...` | Google OAuth Client Secret |
| `SLACK_CLIENT_ID` | `...` | Slack OAuth Client ID |
| `SLACK_CLIENT_SECRET` | `...` | Slack OAuth Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:4000/api/auth/slack/callback` | Slack OAuth Callback URL |
| `WORKER_CONCURRENCY` | `5` | BullMQ concurrent worker threads |
| `DEFAULT_HOURLY_LIMIT` | `50` | Default hourly limit per sender |
| `DEFAULT_MIN_DELAY_MS` | `2000` | Minimum delay between email sends (ms) |
| `ADMIN_KEY` | `reachinbox_admin_secret_key_2026` | Bull Board admin security key |

---

## 🔑 Authentication & Integrations Setup

### 1. Google OAuth Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable Google OAuth 2.0 and set Redirect URI to `http://localhost:4000/api/auth/google/callback`.
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`.
4. *Note: Enter Demo Workspace button is provided on the login page for instant zero-config testing.*

### 2. Slack OAuth Setup
1. Create an app in [Slack API Dashboard](https://api.slack.com/apps).
2. Add Bot Token Scopes: `chat:write`, `incoming-webhook`.
3. Set OAuth Redirect URI to `http://localhost:4000/api/auth/slack/callback`.
4. Add `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` to `.env`.
5. *Note: Quick Demo Slack Connect button is built into the UI for instant testing without app creation.*

### 3. Ethereal Test SMTP Setup
- Ethereal SMTP auto-generates test accounts if `ETHEREAL_USER` and `ETHEREAL_PASS` are left empty.
- Sent emails generate real **Ethereal Message Preview URLs** (`https://ethereal.email/message/...`), allowing full visual verification without sending spam to real recipients.

---

## 🧪 Automated Testing & Production Builds

### Run Automated Backend Unit & Integration Tests
```bash
cd backend
npm test
```
Tests verify:
- Demo workspace per-session data isolation.
- Session persistence and refresh identity retention.
- Cross-user scheduled email privacy & cancellation authorization.
- Session destruction on logout.
- Bull Board admin key protection.
- Google OAuth popup response formatting and postMessage origin handling.
- Google account linking data preservation.
- Duplicate account linking rejection.

### Run Production Builds
```bash
# Backend TypeScript Build
cd backend
npm run build

# Frontend Production Bundle
cd frontend
npm run build
```

---

## 📋 Pre-Deployment Smoke Test Procedure

When deploying to production, follow these steps to verify functionality:

1. **Database & Infrastructure Initialization**:
   - Ensure PostgreSQL, Redis, and Elasticsearch services are healthy.
   - Run `npx prisma migrate deploy` in backend to apply schema migrations.

2. **Environment & OAuth Audit**:
   - Set `CLIENT_URL` to your production frontend domain (e.g. `https://scheduler.reachinbox.ai`).
   - Configure live `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SLACK_CLIENT_ID`, and `SLACK_CLIENT_SECRET`.
   - Update Google and Slack OAuth authorized callback URLs in vendor dashboards.

3. **Smoke Test Sequence**:
   - Open the application URL and click **Enter Demo Workspace**. Confirm dashboard metrics render without errors.
   - Click **Connect Google Account** from the profile dropdown. Complete Google OAuth popup authorization. Verify profile avatar, name, and email update in the Navbar while retaining pre-existing scheduled campaign emails.
   - Click **+ Compose New Email**, import a lead CSV, set sending delay to 2000ms and hourly limit to 2. Confirm jobs appear in the **Scheduled Queue**.
   - Observe worker processing in real-time. Verify rate-limited jobs transition to **Rescheduled (Rate Limit)** status and trigger Slack webhooks if connected.
   - Click **Preview Email ↗** on a delivered email in **Sent Emails** to inspect the Ethereal SMTP rendering.
   - Access `/admin/queues` with header `x-admin-key: <ADMIN_KEY>` to inspect live BullMQ queue metrics.

---

## 📄 License

MIT © ReachInbox Email Scheduling & Dispatch System

