# 🛠️ DENR Scheduler / Planner - Technical Documentation

This repository contains the full-stack codebase for the DENR Scheduler / Planner, a robust event management system designed for the Department of Environment and Natural Resources - CAR.

## 🏗️ Architecture Overview

The application follows a modern decoupled architecture:
1.  **API Server**: A Node.js/Express backend that handles data persistence, authentication, and background scheduling tasks.
2.  **Web Frontend**: A React single-page application (SPA) built with Vite, featuring a responsive and highly interactive UI.

---

## 🛠️ Tech Stack

### Backend (api-server)
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Authentication**: JWT (JSON Web Tokens) with a custom middleware layer.
- **Database Access**: Knex.js (SQL query builder).
- **Date/Time**: Luxon for robust time zone and ISO handling.
- **File Uploads**: Multer for handling event attachments.
- **Email**: NodeMailer-based service for notifications and reminders.

### Frontend (web-frontend)
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router 6
- **State Management**: React Hooks (useState, useMemo, useEffect).
- **Styling**: Standard CSS with a custom variable-based theming system.
- **Icons**: Lucide React.

---

## 📌 API Documentation

### Authentication
- `POST /api/login`: Authenticates a user and returns a JWT.
- `GET /api/me`: Returns the currently authenticated user's profile.

### Events
- `GET /api/events`: Fetches all upcoming events. Automatically triggers the archiving of past events.
- `GET /api/events/archive`: Fetches all archived (past) events.
- `GET /api/office/events`: Fetches events relevant to the logged-in office (created by them or participating).
- `POST /api/events`: Creates a new event.
- `PUT /api/events/:id`: Updates an existing event (restricted to the owner office).
- `DELETE /api/events/:id`: Deletes an event (restricted to the owner office).

### Utilities & Data
- `GET /api/health`: Health check endpoint.
- `GET /api/offices-data`: Returns the static hierarchy of DENR offices and services.
- `GET /api/holidays`: Fetches the list of official holidays.
- `GET /api/employees`: Returns a list of employees for participant selection.
- `POST /api/upload`: Handles file uploads for event attachments.
- `GET /uploads/:filename`: Downloads a previously uploaded attachment (requires auth).

### Admin (Backups & Monitoring)
- `POST /api/admin/stream-token`: Creates a short-lived token for the admin realtime stream.
- `GET /api/admin/stream?st=...`: Server-Sent Events (SSE) realtime stream (requires stream token).
- `GET /api/admin/backup/export`: Downloads a JSON snapshot.
- `POST /api/admin/backup/run`: Forces a backup now.
- `GET /api/admin/backup/list`: Lists available backup files.
- `POST /api/admin/backup/restore`: Restores from a backup (disabled by default; see env vars).

---

## 🗄️ Database Schema (SQL)

The system is optimized for SQL storage using the following table structures:

- **`events`**: Stores upcoming activities.
- **`events_archive`**: Stores past activities moved by the auto-archiver.
- **`office_users`**: Stores user credentials, roles, and office assignments.
- **`holidays`**: Stores non-working days.
- **`employee_details`**: Stores employee names and their respective divisions.

*Note: Large text fields like `participants` and `attachments` are stored as JSON strings in the database.*

---

## ⚙️ Configuration & Deployment

### Environment Variables
Create an `.env` file in the `api-server` directory:
```ini
JWT_SECRET=your_secure_random_secret
PORT=3000
FRONTEND_URL=https://your-app-url.com
CORS_ORIGIN=https://your-app-url.com

# Database Configuration (MySQL/PostgreSQL)
DATABASE_CLIENT=mysql2
DATABASE_URL=mysql://user:pass@host:3306/db_name

# Optional: Switch to local JSON storage for development
# DATA_BACKEND=fs

# Recommended: stable location for uploads/backups/audit logs (outside the repo folder)
DATA_DIR=C:\denr-scheduler-data

# Hidden API (behind IIS / reverse proxy)
TRUST_PROXY=true
# In production, defaults to 127.0.0.1; override only if you need LAN exposure
# BIND_HOST=127.0.0.1

# Upload controls
MAX_UPLOAD_BYTES=10485760
# Comma-separated MIME types
# UPLOAD_MIME_ALLOWLIST=application/pdf,image/png,image/jpeg

# Backups
BACKUP_KEEP=30
# BACKUP_INCLUDE_UPLOADS=true
# Restore is disabled by default (operator-only)
# ENABLE_ADMIN_RESTORE=true

# Admin realtime stream token TTL (ms)
STREAM_TOKEN_TTL_MS=120000

# Time zone (recommended for consistent scheduling)
APP_TIMEZONE=Asia/Manila
```

### Hidden API Behind IIS (Recommended)
To avoid exposing `:3000` on the network:
1. Run the API on loopback (production defaults to `127.0.0.1`).
2. Serve the frontend `web-frontend/dist` via IIS.
3. Configure IIS reverse proxy rules:
   - `/api/*` → `http://127.0.0.1:3000/api/*`
   - `/uploads/*` → `http://127.0.0.1:3000/uploads/*`
4. The frontend will call same-origin `/api/...` automatically when `VITE_API_BASE_URL` is not set.

### Production Build
1.  **Backend**: Run `npm run build` in `api-server` to compile TypeScript to JavaScript.
2.  **Frontend**: Run `npm run build` in `web-frontend` to generate the optimized production assets in the `dist/` folder.

---

## 🤖 Background Tasks
The server runs several automated processes:
- **Auto-Archiver**: Runs every 10 minutes to move past events from the active list to the archive.
- **Reminder System**: Scans events hourly and sends email reminders 3 days before an activity starts.

---
**Looking for usage instructions?**  
Check out the [USER_GUIDE.md](./USER_GUIDE.md) for a functional walkthrough.

© 2026 DENR Planner - *Committed to Sustainable Environmental Management.*
