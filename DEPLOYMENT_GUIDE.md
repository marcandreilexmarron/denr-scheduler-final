# Deployment Guide (Windows + IIS, Hidden API)
This guide deploys the DENR Scheduler/Planner on a single Windows machine with:
- MySQL on the same machine
- IIS serving the frontend (`web-frontend/dist`)
- IIS reverse-proxying `/api/*` and `/uploads/*` to a local Node API (`127.0.0.1:3000`)

## 1) Prerequisites
- Node.js 18+ installed on the server
- MySQL installed and running
- IIS installed
- IIS modules:
  - URL Rewrite
  - ARR (Application Request Routing) with Proxy enabled

## 2) Database (MySQL)
1. Create the database (example name: `scheduler_db`).
2. Create tables using the MySQL DDL in:
   - `api-server/README-DB.md`
3. Recommended DB hardening:
   - Create a dedicated DB user (avoid using `root`).
   - Restrict DB bind address and firewall rules so DB is not exposed publicly unless required.

## 3) Filesystem layout (recommended)
Pick a stable data directory outside the repo (uploads/backups/audit logs):
- `C:\denr-scheduler-data`

This folder should be included in your server backup routine.

## 4) Configure API environment variables
Set environment variables at the machine level (recommended) or via your service wrapper.

Minimum recommended values:
```ini
NODE_ENV=production
PORT=3000

# Hidden API mode
BIND_HOST=127.0.0.1
TRUST_PROXY=true

# Auth
JWT_SECRET=replace_with_secure_random_value

# CORS (same-origin behind IIS; still recommended to set)
FRONTEND_URL=https://your-domain-or-server-ip
CORS_ORIGIN=https://your-domain-or-server-ip

# Storage
DATA_BACKEND=db
DATABASE_CLIENT=mysql2
DATABASE_URL=mysql://dbuser:dbpass@localhost:3306/scheduler_db

# Files
DATA_DIR=C:\denr-scheduler-data

# Time zone (recommended)
APP_TIMEZONE=Asia/Manila

# Upload controls
MAX_UPLOAD_BYTES=10485760
# UPLOAD_MIME_ALLOWLIST=application/pdf,image/png,image/jpeg

# Backups
BACKUP_KEEP=30
# BACKUP_INCLUDE_UPLOADS=true

# Restore is disabled by default; enable only when needed
# ENABLE_ADMIN_RESTORE=true
```

Important:
- Do not store real secrets inside the repo. Treat `JWT_SECRET`, SMTP credentials, and DB credentials as secrets.

## 5) Build the API (one-time per deployment)
From the repo root on the server:
```bash
cd api-server
npm install
npm run build
```

## 6) Run the API (hidden behind IIS)
Run manually (for a quick verification):
```bash
cd api-server
npm start
```

Verify it is reachable locally on the server:
- `http://127.0.0.1:3000/api/health`

### Run the API as a Windows service (recommended)
Use one of these:
- NSSM (Non-Sucking Service Manager)
- PM2 + pm2-windows-service

The service should run:
- Working directory: `...\denr-scheduler-final\api-server`
- Command: `node dist/server.js`

## 7) Build the frontend
```bash
cd web-frontend
npm install
npm run build
```

Output folder:
- `web-frontend/dist`

Notes:
- The frontend is already configured to use same-origin `/api/...` when `VITE_API_BASE_URL` is not set.

## 8) Configure IIS to serve the frontend
1. Create an IIS Website
2. Set Physical Path to:
   - `...\denr-scheduler-final\web-frontend\dist`
3. Bindings:
   - HTTP (80) and/or HTTPS (443)

## 9) Configure IIS reverse proxy (hide the API port)
Goal:
- Public: `https://your-domain/`
- API: `https://your-domain/api/...` (proxied)
- Uploads: `https://your-domain/uploads/...` (proxied)

Create URL Rewrite rules (conceptually):
- Match: `^api/(.*)` → Rewrite to: `http://127.0.0.1:3000/api/{R:1}`
- Match: `^uploads/(.*)` → Rewrite to: `http://127.0.0.1:3000/uploads/{R:1}`

ARR/Proxy settings:
- Enable Proxy in ARR
- Preserve Host Header (recommended)
- Ensure `X-Forwarded-For` is forwarded (IIS/ARR typically does this)

## 10) Firewall (recommended)
- Block inbound TCP 3000 from the network.
- Only IIS should reach the API via `127.0.0.1`.

## 11) Post-deploy checks
- Open the site: `https://your-domain/`
- Login and create an event
- Upload and download an attachment
- Admin panel:
  - Admin realtime status connects (SSE stream token flow)
  - Backups list/export works

## 12) Troubleshooting
- 502/Proxy errors in IIS:
  - Confirm Node API is running and health check works locally.
  - Confirm ARR Proxy is enabled.
  - Confirm rewrite rules for `/api` and `/uploads`.
- CORS blocked:
  - If frontend and API are same-origin through IIS, CORS should not trigger.
  - Still set `FRONTEND_URL` and `CORS_ORIGIN` to your IIS URL for safety.
- Upload fails with unsupported type:
  - Add the needed MIME type to `UPLOAD_MIME_ALLOWLIST` or upload a supported type.
