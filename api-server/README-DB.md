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
  - `npm i knex` (already added)
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
setx DATABASE_CLIENT "pg"
setx DATABASE_URL "postgres://user:pass@host:5432/dbname"
```
Restart your terminal after `setx` so Node sees the variables.

## Expected Schema
The SQL backend reads/writes these tables:

### events
- id TEXT/VARCHAR PRIMARY KEY  
- title TEXT NOT NULL  
- category TEXT  
- dateType TEXT NOT NULL            // 'single' or 'range'  
- date DATE NULL                    // single-date  
- startDate DATE NULL               // range  
- endDate DATE NULL  
- startTime TEXT NULL               // 'HH:mm'  
- endTime TEXT NULL  
- office TEXT NULL  
- participants JSON/TEXT            // JSON array of strings  
- participantTokens JSON/TEXT       // JSON array of strings  
- createdBy TEXT NULL  
- createdByOffice TEXT NULL  
- createdAt TIMESTAMP/DateTime NOT NULL  
- location TEXT NULL  
- description TEXT NULL  
- attachments JSON/TEXT             // JSON array

### events_archive
Same columns as `events`. Used for past events moved out of the active list.

### users
- username TEXT/VARCHAR PRIMARY KEY  
- password TEXT NOT NULL             // stored as plain here; you can hash later  
- role TEXT NOT NULL                 // e.g., 'ADMIN', 'OFFICE'  
- officeName TEXT NULL  
- service TEXT NULL

### holidays
- month INTEGER NOT NULL  
- day INTEGER NOT NULL  
- name TEXT NULL

### employees
Flexible; returned as-is by the API. Suggested columns: `name`, `officeName`, `position`, etc.

## DDL Examples

### Postgres
```sql
create table if not exists users (
  username text primary key,
  password text not null,
  role text not null,
  officeName text,
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
  dateType text not null,
  date date,
  startDate date,
  endDate date,
  startTime text,
  endTime text,
  office text,
  participants jsonb,
  participantTokens jsonb,
  createdBy text,
  createdByOffice text,
  createdAt timestamptz not null,
  location text,
  description text,
  attachments jsonb
);

create table if not exists events_archive (like events including all);
```

### MySQL/MariaDB
```sql
create table if not exists users (
  username varchar(191) primary key,
  password varchar(255) not null,
  role varchar(64) not null,
  officeName varchar(255),
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
  dateType varchar(16) not null,
  date date,
  startDate date,
  endDate date,
  startTime varchar(5),
  endTime varchar(5),
  office varchar(255),
  participants json,
  participantTokens json,
  createdBy varchar(255),
  createdByOffice varchar(255),
  createdAt datetime not null,
  location varchar(512),
  description text,
  attachments json
);

create table if not exists events_archive like events;
```

If your engine lacks native JSON, use TEXT for the JSON columns; the server will serialize/deserialize.

## Run the API with DB
From `api-server`:
```
npm run build
npm start
```
When `DATA_BACKEND=db` is set and the driver is installed, the API reads/writes SQL tables automatically. The frontend keeps using the same `/api` endpoints.

## Importing Existing JSON Data (Optional)
- If you want to move current JSON data to the DB:
  - Create tables using the DDL above.
  - Temporarily run with `DATA_BACKEND=fs` to confirm data shape.
  - Write a short script to read `api-server/data/*.json` and insert into your tables, or export via the API and insert. (Ask if you want me to add a seeding script.)

## Troubleshooting
- Connection errors: verify `DATABASE_CLIENT`, `DATABASE_URL`, and that you installed the correct driver package.
- SSL/managed DBs: some providers require SSL flags in `DATABASE_URL` (e.g. `?sslmode=require` for Postgres).
- Migrations: adopting a migration tool (Knex migrations, Prisma, etc.) is recommended for managing schema changes long-term.
