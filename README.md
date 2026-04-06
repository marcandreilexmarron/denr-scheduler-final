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
- **Email**: NodeMailer-based service for notifications and reminders. (CURRENTLY DISABLED)

### Frontend (web-frontend)
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router 6
- **State Management**: React Hooks (useState, useMemo, useEffect).
- **Styling**: Standard CSS with a custom variable-based theming system.
- **Icons**: Lucide React.

---

## � API Documentation

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

---

## �️ Database Schema (SQL)

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

# Database Configuration (MySQL/PostgreSQL)
DATABASE_CLIENT=mysql2
DATABASE_URL=mysql://user:pass@host:3306/db_name

# Optional: Switch to local JSON storage for development
# DATA_BACKEND=fs
```

### Production Build
1.  **Backend**: Run `npm run build` in `api-server` to compile TypeScript to JavaScript.
2.  **Frontend**: Run `npm run build` in `web-frontend` to generate the optimized production assets in the `dist/` folder.

---

## 🤖 Background Tasks
The server runs several automated processes:
- **Auto-Archiver**: Runs every 10 minutes to move past events from the active list to the archive.
- **Reminder System**: Scans events hourly and sends email reminders 3 days before an activity starts. (CURRENTLY DISABLED)

---
**Looking for usage instructions?**  
Check out the [USER_GUIDE.md](./USER_GUIDE.md) for a functional walkthrough.

© 2026 DENR Planner - *Committed to Sustainable Environmental Management.*
