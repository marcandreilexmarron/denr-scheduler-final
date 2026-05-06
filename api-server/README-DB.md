# Database Backend Setup (API Server)

This guide explains how to run the API server using a SQL database instead of the default JSON files. The server uses a pluggable storage layer so you can switch between file storage and a SQL backend without changing the frontend.

## Overview
- Storage selector: `src/storage-select.ts` chooses between:
  - File storage (default): `src/storage.ts`
  - SQL storage: `src/storage-db.ts` (uses Knex)
- Switch by environment variable `DATA_BACKEND`:
  - `DATA_BACKEND=fs` → JSON files in `api-server/data`
  - `DATA_BACKEND=db` → SQL database through Knex

## Requirements
- Node.js 18+ (recommended)
- API server dependencies installed:
  - `npm i` (in `api-server/`)
- Install the driver for your SQL engine:
  - Postgres: `npm i pg`
  - MySQL/MariaDB: `npm i mysql2`
  - SQL Server: `npm i mssql`
  - SQLite: `npm i sqlite3` or `npm i better-sqlite3`

## Configure Environment
Set these environment variables for the API server:
- `DATA_BACKEND=db`
- `DATABASE_CLIENT` — one of: `pg`, `mysql2`, `mssql`, `sqlite3`, `better-sqlite3`
- `DATABASE_URL` — standard connection string for your driver (e.g. `postgres://user:pass@host:5432/dbname`)

Examples (PowerShell):
```
setx DATA_BACKEND "db"
setx DATABASE_CLIENT "mysql2"
setx DATABASE_URL "mysql://user:pass@localhost:3306/scheduler_db"
```
Restart your terminal after `setx` so Node sees the variables.

## Expected Schema
The SQL backend reads/writes these tables:

### events
- id TEXT/VARCHAR PRIMARY KEY  
- title TEXT NOT NULL  
- category TEXT  
- date DATE NULL                    // single-date  
- date_type TEXT NOT NULL           // 'single' or 'range'  
- start_date DATE NULL              // range  
- end_date DATE NULL  
- start_time TEXT NULL              // 'HH:mm'  
- end_time TEXT NULL  
- office TEXT NULL  
- participants JSON/TEXT            // JSON array of strings  
- participant_tokens JSON/TEXT      // JSON array of strings  
- created_by TEXT NULL  
- created_by_office TEXT NULL  
- created_at TIMESTAMP/DateTime NOT NULL  
- location TEXT NULL  
- description TEXT NULL  
- attachments JSON/TEXT             // JSON array
- category_detail TEXT NULL
- type TEXT NULL

### events_archive
Same columns as `events`. Used for past events moved out of the active list.

### office_users
- username TEXT/VARCHAR PRIMARY KEY  
- password TEXT NOT NULL             // stored as an scrypt hash (format: `scrypt$...`)  
- role TEXT NOT NULL                 // e.g., 'ADMIN', 'OFFICE'  
- office_name TEXT NULL  
- service TEXT NULL

### holidays
- month INTEGER NOT NULL  
- day INTEGER NOT NULL  
- name TEXT NULL

Recommended constraint:
- Unique index on `(month, day)` to prevent duplicates.

### employee_details
Flexible; returned as-is by the API. The API maps `division` → `officeName`.

## DDL Examples

### Postgres
```sql
create table if not exists office_users (
  username text primary key,
  password text not null,
  role text not null,
  office_name text,
  service text
);

create table if not exists holidays (
  month integer not null,
  day integer not null,
  name text
);

create table if not exists events (
  id text primary key,
  title text not null,
  category text,
  date_type text not null,
  date date,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  office text,
  participants jsonb,
  participant_tokens jsonb,
  created_by text,
  created_by_office text,
  created_at timestamptz not null,
  location text,
  description text,
  attachments jsonb,
  category_detail text,
  type text
);

create table if not exists events_archive (like events including all);

create table if not exists employee_details (
  name text,
  division text,
  position text
);
```

### MySQL/MariaDB
```sql
create table if not exists office_users (
  username varchar(191) primary key,
  password varchar(255) not null,
  role varchar(64) not null,
  office_name varchar(255),
  service varchar(255)
);

create table if not exists holidays (
  month int not null,
  day int not null,
  name varchar(255)
);

create table if not exists events (
  id varchar(191) primary key,
  title text not null,
  category varchar(128),
  date_type varchar(16) not null,
  date date,
  start_date date,
  end_date date,
  start_time varchar(5),
  end_time varchar(5),
  office varchar(255),
  participants json,
  participant_tokens json,
  created_by varchar(255),
  created_by_office varchar(255),
  created_at datetime not null,
  location varchar(512),
  description text,
  attachments json,
  category_detail text,
  type varchar(64)
);

create table if not exists events_archive like events;

create table if not exists employee_details (
  name varchar(255),
  division varchar(255),
  position varchar(255)
);
```

If your engine lacks native JSON, use TEXT for the JSON columns; the server will serialize/deserialize.

## Run the API with DB
From `api-server`:
```
npm run build
npm start
```
When `DATA_BACKEND=db` is set and the driver is installed, the API reads/writes SQL tables automatically. The frontend keeps using the same `/api` endpoints.

## Notes on Write Behavior
- The DB backend syncs `events`, `events_archive`, and `office_users` using upserts by key and deletes missing rows (instead of truncating tables on every write).
- For uploads/backups/audit logs, set `DATA_DIR` so files are stored outside the repo folder.

## Importing Existing JSON Data (Optional)
- If you want to move current JSON data to the DB:
  - Create tables using the DDL above.
  - Temporarily run with `DATA_BACKEND=fs` to confirm data shape.
  - Write a short script to read `api-server/data/*.json` and insert into your tables, or export via the API and insert. (Ask if you want me to add a seeding script.)

## Troubleshooting
- Connection errors: verify `DATABASE_CLIENT`, `DATABASE_URL`, and that you installed the correct driver package.
- SSL/managed DBs: some providers require SSL flags in `DATABASE_URL` (e.g. `?sslmode=require` for Postgres).
- Migrations: adopting a migration tool (Knex migrations, Prisma, etc.) is recommended for managing schema changes long-term.
