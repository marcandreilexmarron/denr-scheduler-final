import * as fsStore from "./storage.js";
import * as dbStore from "./storage-db.js";
import path from "path";
const backend = (process.env.DATA_BACKEND || "db").toLowerCase();

export function getDataDir(): string {
  const configured = String(process.env.DATA_DIR || "").trim();
  if (configured) return path.resolve(configured);
  return fsStore.getDataDir();
}

export async function readEvents(): Promise<any[]> {
  if (backend === "db") return await dbStore.readEvents();
  return Promise.resolve(fsStore.readEvents());
}
export async function writeEvents(events: any[]): Promise<void> {
  if (backend === "db") return await dbStore.writeEvents(events);
  return Promise.resolve(fsStore.writeEvents(events));
}
export async function readArchivedEvents(): Promise<any[]> {
  if (backend === "db") return await dbStore.readArchivedEvents();
  return Promise.resolve(fsStore.readArchivedEvents());
}
export async function writeArchivedEvents(events: any[]): Promise<void> {
  if (backend === "db") return await dbStore.writeArchivedEvents(events);
  return Promise.resolve(fsStore.writeArchivedEvents(events));
}
export async function readUsers(): Promise<any[]> {
  if (backend === "db") return await dbStore.readUsers();
  return Promise.resolve(fsStore.readUsers());
}
export async function writeUsers(users: any[]): Promise<void> {
  if (backend === "db") return await dbStore.writeUsers(users);
  return Promise.resolve(fsStore.writeUsers(users));
}
export async function readHolidays(): Promise<Array<{ month: number; day: number; name?: string }>> {
  if (backend === "db") return await dbStore.readHolidays();
  return Promise.resolve(fsStore.readHolidays());
}
export async function writeHolidays(holidays: Array<{ month: number; day: number; name?: string }>): Promise<void> {
  if (backend === "db") return await dbStore.writeHolidays(holidays);
  return Promise.resolve(fsStore.writeHolidays(holidays));
}
export async function readEmployees(): Promise<any[]> {
  if (backend === "db") return await dbStore.readEmployees();
  return Promise.resolve(fsStore.readEmployees());
}

export async function pingStorage(): Promise<void> {
  if (backend === "db") return await dbStore.ping();
  return;
}
