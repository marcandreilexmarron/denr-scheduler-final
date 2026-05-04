import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

function readJsonSafe<T = any>(p: string, fallback: T): T {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writePretty(p: string, obj: any) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function writeEventsCompact(p: string, events: any[]) {
  const content = "[\n" + events.map((e) => JSON.stringify(e)).join(",\n") + "\n]";
  fs.writeFileSync(p, content, "utf-8");
}

export function getDataDir() {
  return dataDir;
}

const EVENTS = path.join(dataDir, "events.json");
const ARCHIVE = path.join(dataDir, "events-archive.json");
const USERS = path.join(dataDir, "users.json");
const HOLIDAYS = path.join(dataDir, "holidays.json");
const EMPLOYEES = path.join(dataDir, "employees.json");

export function readEvents(): any[] {
  return readJsonSafe<any[]>(EVENTS, []);
}
export function writeEvents(events: any[]) {
  writeEventsCompact(EVENTS, events);
}
export function readArchivedEvents(): any[] {
  return readJsonSafe<any[]>(ARCHIVE, []);
}
export function writeArchivedEvents(events: any[]) {
  writeEventsCompact(ARCHIVE, events);
}

export function readUsers(): any[] {
  return readJsonSafe<any[]>(USERS, []);
}
export function writeUsers(users: any[]) {
  writePretty(USERS, users);
}

export function readHolidays(): Array<{ month: number; day: number; name?: string }> {
  return readJsonSafe(HOLIDAYS, []);
}
export function writeHolidays(holidays: Array<{ month: number; day: number; name?: string }>) {
  writePretty(HOLIDAYS, holidays);
}

export function readEmployees(): any[] {
  return readJsonSafe<any[]>(EMPLOYEES, []);
}
