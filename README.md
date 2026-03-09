 # DENR Scheduler / Planner

 A simple two-part system for planning and tracking events across DENR offices:

- API Server: Express + TypeScript serving file-backed endpoints (optional SQL backend)
 - Web Frontend: React + Vite providing the planner UI

 This repository contains both parts under denr-scheduler-final.

 ## Features

 - User authentication with JWT (ADMIN and OFFICE roles)
 - Office- and service-based views and filtering
 - Calendar with single-day and multi-day events
 - Event categories with color coding
 - Admin user management (create, update role/office/service, delete)
 - Holidays overlay

 ## Tech Stack

- API: Node.js, Express, TypeScript, jsonwebtoken, Luxon (optional Knex + SQL driver)
 - Frontend: React 18, Vite, React Router

 ## Prerequisites

 - Node.js 18+ and npm

 ## Project Structure

 ```text
 denr-scheduler-final/
 ├─ api-server/                 # Express + TypeScript API
 │  ├─ src/
 │  │  ├─ server.ts             # API endpoints and boot code
 │  │  └─ auth.ts               # JWT utilities and middleware
 │  ├─ data/                    # JSON storage (users, events, holidays)
 │  ├─ package.json
 │  └─ tsconfig.json
 └─ web-frontend/               # React + Vite SPA
    ├─ src/
    ├─ index.html
    ├─ vite.config.ts           # Proxy /api → http://localhost:3000
    └─ package.json
 ```

 ## Quick Start (Development)

 Open two terminals, one per package.

 1) API Server

 ```bash
 cd denr-scheduler-final/api-server
 npm install
 # optional: create .env and set JWT_SECRET and/or PORT
 npm run dev
 # → listens on http://localhost:3000
 ```

 2) Web Frontend

 ```bash
 cd denr-scheduler-final/web-frontend
 npm install
 npm run dev
 # → visit http://localhost:5173
 # Vite dev proxy forwards /api to http://localhost:3000
 ```

 ## Environment Variables (API)

 Create api-server/.env as needed:

 ```ini
 # api-server/.env
 JWT_SECRET=change-me-in-production
 PORT=3000

# Optional: enable SQL backend instead of JSON files
# DATA_BACKEND=db
# DATABASE_CLIENT=mysql2
# DATABASE_URL=mysql://user:pass@localhost:3306/scheduler_db
 ```

 Defaults if not provided:

 - JWT_SECRET: dev-insecure-secret
 - PORT: 3000

## Database Backend (Optional)

The API supports switching storage from JSON files to a SQL database by setting `DATA_BACKEND=db` and providing `DATABASE_CLIENT` / `DATABASE_URL`.

See: `denr-scheduler-final/api-server/README-DB.md`

 ## Default Data and Credentials

 The API uses JSON files under api-server/data for storage.

 - Users: api-server/data/users.json
 - Events: api-server/data/events.json
 - Holidays: api-server/data/holidays.json

 Sample credentials are provided for initial access. For example:

 - ADMIN
   - username: admin
   - password: password
 - OFFICE (examples)
   - username: ord_admin, password: password
   - username: smd_admin, password: password

 Use the Admin page to create or manage users and assign services/offices.

 ## Available Scripts

 In api-server:

 - npm run dev – start API in watch mode
 - npm run build – compile to dist/
 - npm start – run compiled server (after build)

 In web-frontend:

 - npm run dev – start Vite dev server
 - npm run build – build static assets to dist/
 - npm run preview – preview the built app locally

 ## Production Build

 1) Build both packages

 ```bash
 cd denr-scheduler-final/api-server
 npm install && npm run build

 cd ../web-frontend
 npm install && npm run build
 ```

 2) Run API

 ```bash
 cd denr-scheduler-final/api-server
 NODE_ENV=production PORT=3000 JWT_SECRET=<strong-secret> npm start
 ```

 3) Serve Frontend

 - Deploy web-frontend/dist via any static HTTP server or object storage + CDN
 - Configure a reverse proxy to route /api to the API server (default http://localhost:3000)

 ## API Overview

 - GET /api/health – health check
 - POST /api/login – returns { token } for valid credentials
 - GET /api/me – current user info (requires Authorization: Bearer <token>)
 - GET /api/offices-data – services and offices list
 - GET /api/calendar[?month=&year=] – calendar data and holidays for a month
 - GET /api/events – list all events
 - GET /api/office/events – events relevant to the logged-in user’s office/service (auth)
 - GET /api/holidays – list holidays
 - Users (auth: ADMIN):
   - GET /api/users
   - POST /api/users
   - PUT /api/users/:username
   - DELETE /api/users/:username
 - Events (auth: ADMIN or OFFICE):
   - POST /api/events
   - PUT /api/events/:id
   - DELETE /api/events/:id

 ## Notes

 - The development setup relies on Vite’s proxy to avoid CORS issues.
 - Replace the default JWT_SECRET for any non-local environment.
 - JSON files are edited by the API at runtime; commit curated seed data only.

