import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
function readJsonSafe(p, fallback) {
    try {
        if (!fs.existsSync(p))
            return fallback;
        const raw = fs.readFileSync(p, "utf-8").trim();
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
function writePretty(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}
function writeEventsCompact(p, events) {
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
export function readEvents() {
    return readJsonSafe(EVENTS, []);
}
export function writeEvents(events) {
    writeEventsCompact(EVENTS, events);
}
export function readArchivedEvents() {
    return readJsonSafe(ARCHIVE, []);
}
export function writeArchivedEvents(events) {
    writeEventsCompact(ARCHIVE, events);
}
export function readUsers() {
    return readJsonSafe(USERS, []);
}
export function writeUsers(users) {
    writePretty(USERS, users);
}
export function readHolidays() {
    return readJsonSafe(HOLIDAYS, []);
}
export function writeHolidays(holidays) {
    writePretty(HOLIDAYS, holidays);
}
export function readEmployees() {
    return readJsonSafe(EMPLOYEES, []);
}
