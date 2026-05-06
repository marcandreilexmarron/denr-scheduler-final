import * as fsStore from "./storage.js";
import * as dbStore from "./storage-db.js";
import path from "path";
const backend = (process.env.DATA_BACKEND || "db").toLowerCase();
export function getDataDir() {
    const configured = String(process.env.DATA_DIR || "").trim();
    if (configured)
        return path.resolve(configured);
    return fsStore.getDataDir();
}
export async function readEvents() {
    if (backend === "db")
        return await dbStore.readEvents();
    return Promise.resolve(fsStore.readEvents());
}
export async function writeEvents(events) {
    if (backend === "db")
        return await dbStore.writeEvents(events);
    return Promise.resolve(fsStore.writeEvents(events));
}
export async function readArchivedEvents() {
    if (backend === "db")
        return await dbStore.readArchivedEvents();
    return Promise.resolve(fsStore.readArchivedEvents());
}
export async function writeArchivedEvents(events) {
    if (backend === "db")
        return await dbStore.writeArchivedEvents(events);
    return Promise.resolve(fsStore.writeArchivedEvents(events));
}
export async function readUsers() {
    if (backend === "db")
        return await dbStore.readUsers();
    return Promise.resolve(fsStore.readUsers());
}
export async function writeUsers(users) {
    if (backend === "db")
        return await dbStore.writeUsers(users);
    return Promise.resolve(fsStore.writeUsers(users));
}
export async function readHolidays() {
    if (backend === "db")
        return await dbStore.readHolidays();
    return Promise.resolve(fsStore.readHolidays());
}
export async function writeHolidays(holidays) {
    if (backend === "db")
        return await dbStore.writeHolidays(holidays);
    return Promise.resolve(fsStore.writeHolidays(holidays));
}
export async function readEmployees() {
    if (backend === "db")
        return await dbStore.readEmployees();
    return Promise.resolve(fsStore.readEmployees());
}
export async function pingStorage() {
    if (backend === "db")
        return await dbStore.ping();
    return;
}
