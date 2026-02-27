import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { authMiddleware, signToken, requireRole, requireAnyRole } from "./auth.js";
import crypto from "crypto";
import { DateTime } from "luxon";
import { fileURLToPath } from "url";
import {
  readEvents,
  writeEvents,
  readArchivedEvents,
  writeArchivedEvents,
  readUsers,
  writeUsers,
  readHolidays,
  readEmployees,
  getDataDir
} from "./storage-select.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

function readJson(p: string) {
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(p, "utf-8").trim();
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeEventsFile(p: string, events: any[]) {
  const content = "[\n" + events.map((e) => JSON.stringify(e)).join(",\n") + "\n]";
  fs.writeFileSync(p, content, "utf-8");
}

function parseDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split("-").map((n: string) => Number(n));
    let hh = 23, mm = 59;
    if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
      const [h2, m2] = timeStr.split(":").map((n: string) => Number(n));
      hh = isFinite(h2) ? h2 : 23;
      mm = isFinite(m2) ? m2 : 59;
    }
    return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  } catch {
    return null;
  }
}
function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}
function isEventPast(ev: any): boolean {
  // Past = event's last day is before today (ignore time-of-day)
  const today = startOfToday().getTime();
  if (ev?.dateType === "range" && ev?.startDate && ev?.endDate) {
    const end = parseDateTime(ev.endDate, ev.endTime) || parseDateTime(ev.endDate, "17:00");
    return (end?.getTime() ?? today) < today;
  }
  if (ev?.date) {
    const end = parseDateTime(ev.date, ev.endTime || ev.startTime || "17:00");
    // Treat a single-day event as past only if its day is strictly before today
    const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : today;
    return endDay < today;
  }
  return false;
}
async function archivePastEvents(): Promise<any[]> {
  const current = await readEvents();
  const events = current.map((e) => {
    if (!e.id) e.id = crypto.randomUUID();
    return e;
  });
  const archivedExisting = await readArchivedEvents();
  const past = events.filter(isEventPast);
  const upcoming = events.filter((e) => !isEventPast(e));
  if (past.length > 0) {
    await writeEvents(upcoming);
    await writeArchivedEvents([...archivedExisting, ...past]);
    return upcoming;
  }
  return events;
}

async function ensureEventIds(): Promise<any[]> {
  const events = await readEvents();
  let mutated = false;
  for (const ev of events) {
    if (!ev.id) {
      ev.id = crypto.randomUUID();
      mutated = true;
    }
  }
  if (mutated) {
    await writeEvents(events);
  }
  return events;
}

async function backfillDivisionChiefTokens() {
  const events = await readEvents();
  const { services } = getServicesStructure();
  const divisionOffices = new Set((services ?? []).flatMap((svc: any) => (svc?.offices ?? []).map((o: any) => o.name)));
  let mutated = false;
  for (const ev of events) {
    const parts: string[] = Array.isArray(ev?.participants) ? ev.participants : [];
    const tokens: string[] = Array.isArray(ev?.participantTokens) ? ev.participantTokens : [];
    if (tokens.includes("Division Chiefs")) continue;
    if (divisionOffices.size === 0) continue;
    let hasAllDivisionOffices = true;
    for (const name of divisionOffices) {
      if (!parts.includes(name)) {
        hasAllDivisionOffices = false;
        break;
      }
    }
    if (hasAllDivisionOffices) {
      ev.participantTokens = [...tokens, "Division Chiefs"];
      mutated = true;
    }
  }
  if (mutated) {
    await writeEvents(events);
  }
}

async function backfillDivisionChiefTokensArchive() {
  const events = await readArchivedEvents();
  const { services } = getServicesStructure();
  const divisionOffices = new Set((services ?? []).flatMap((svc: any) => (svc?.offices ?? []).map((o: any) => o.name)));
  let mutated = false;
  for (const ev of events) {
    const parts: string[] = Array.isArray(ev?.participants) ? ev.participants : [];
    const tokens: string[] = Array.isArray(ev?.participantTokens) ? ev.participantTokens : [];
    if (tokens.includes("Division Chiefs")) continue;
    if (divisionOffices.size === 0) continue;
    let hasAllDivisionOffices = true;
    for (const name of divisionOffices) {
      if (!parts.includes(name)) {
        hasAllDivisionOffices = false;
        break;
      }
    }
    if (hasAllDivisionOffices) {
      ev.participantTokens = [...tokens, "Division Chiefs"];
      mutated = true;
    }
  }
  if (mutated) {
    await writeArchivedEvents(events);
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = getDataDir();

function getServicesStructure() {
  const topLevelOffices = [
    { name: "Office of the Regional Director", icon: "fa-building-user" },
    { name: "Office of the Assistant Regional Director for Management Services", icon: "fa-user-tie" },
    { name: "Office of the Assistant Regional Director for Technical Services", icon: "fa-user-cog" }
  ];
  const services = [
    {
      name: "Technical Services",
      offices: [
        { name: "Surveys and Mapping Division", icon: "fa-map-marked-alt" },
        { name: "Licenses, Patents and Deeds Division", icon: "fa-file-contract" },
        { name: "Conservation and Development Division", icon: "fa-seedling" },
        { name: "Enforcement Division", icon: "fa-shield-alt" }
      ]
    },
    {
      name: "Management Services",
      offices: [
        { name: "Planning and Management Division", icon: "fa-tasks" },
        { name: "Legal Division", icon: "fa-gavel" },
        { name: "Administrative Division", icon: "fa-users-cog" },
        { name: "Finance Division", icon: "fa-dollar-sign" }
      ]
    }
  ];
  return { topLevelOffices, services };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const user = (req as any).user;
  res.json(user);
});

app.get("/api/offices-data", (_req, res) => {
  res.json(getServicesStructure());
});

app.get("/api/calendar", async (req, res) => {
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const now = DateTime.now();
  const ym = DateTime.fromObject({
    year: year ?? now.year,
    month: month ?? now.month,
    day: 1
  });
  const allHolidays = (await readHolidays()) as Array<{ month: number; day: number; name: string }>;
  const monthHolidays = allHolidays.filter((h) => h.month === ym.month);

  let firstDayOfWeek = ym.weekday; // 1=Mon..7=Sun
  if (firstDayOfWeek === 7) firstDayOfWeek = 0; // Sunday start adjustment
  const daysInMonth = ym.daysInMonth ?? 30;
  const today = ym.hasSame(now, "month") && ym.hasSame(now, "year") ? now.day : 0;
  const calendarDays: Array<{ day: number | string; isToday: boolean; holiday: any | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push({ day: "", isToday: false, holiday: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const holiday = monthHolidays.find((h) => h.day === d) ?? null;
    calendarDays.push({ day: d, isToday: d === today, holiday });
  }
  const prev = ym.minus({ months: 1 });
  const next = ym.plus({ months: 1 });
  res.json({
    yearMonth: ym.toFormat("MMMM yyyy"),
    previousMonth: prev.month,
    previousYear: prev.year,
    nextMonth: next.month,
    nextYear: next.year,
    calendarDays,
    today,
    holidays: monthHolidays
  });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const users = await readUsers();
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const token = signToken({
    sub: user.username,
    role: user.role,
    officeName: user.officeName,
    service: user.service
  });
  res.json({ token });
});

function isHolidayDate(d: Date, holidays: Array<{ month: number; day: number }>) {
  return holidays.some((h) => h.month === d.getMonth() + 1 && h.day === d.getDate());
}
function parseYMD(s?: string): Date | null {
  if (!s) return null;
  try {
    const [y, m, d] = String(s).split("-").map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1);
  } catch {
    return null;
  }
}
function isHolidayOnlyEvent(ev: any, holidays: Array<{ month: number; day: number }>): boolean {
  if (ev?.dateType === "range" && ev?.startDate && ev?.endDate) {
    const start = parseYMD(ev.startDate);
    const end = parseYMD(ev.endDate);
    if (!start || !end) return false;
    const cur = new Date(start);
    let anyNonHoliday = false;
    while (cur <= end) {
      if (!isHolidayDate(cur, holidays)) {
        anyNonHoliday = true;
        break;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return !anyNonHoliday;
  }
  if (ev?.date) {
    const d = parseYMD(ev.date);
    return d ? isHolidayDate(d, holidays) : false;
  }
  return false;
}

app.get("/api/events", async (_req, res) => {
  await archivePastEvents();
  await backfillDivisionChiefTokens();
  await backfillDivisionChiefTokensArchive();
  const holidays = (await readHolidays()) as Array<{ month: number; day: number; name: string }>;
  const simpleHolidays = holidays.map((h) => ({ month: h.month, day: h.day }));
  const events = (await readEvents()).filter((e) => !isHolidayOnlyEvent(e, simpleHolidays));
  res.json(events);
});

app.get("/api/office/events", authMiddleware, async (req, res) => {
  await archivePastEvents();
  await backfillDivisionChiefTokens();
  await backfillDivisionChiefTokensArchive();
  const user = (req as any).user as any;
  const holidays = (await readHolidays()) as Array<{ month: number; day: number; name: string }>;
  const simpleHolidays = holidays.map((h) => ({ month: h.month, day: h.day }));
  const events = (await readEvents()).filter((e) => !isHolidayOnlyEvent(e, simpleHolidays));
  const { services } = getServicesStructure();
  const svc = services.find((s: any) => s.name === user.service);
  const serviceOfficeNames = new Set((svc?.offices ?? []).map((o: any) => o.name));
  const filtered = events.filter((e: any) => {
    if (e.office && e.office === user.officeName) return true;
    if (Array.isArray(e.participants)) {
      if (e.participants.includes(user.officeName)) return true;
      for (const name of e.participants) {
        if (serviceOfficeNames.has(name)) return true;
      }
    }
    return false;
  });
  res.json(filtered);
});

app.get("/api/holidays", async (_req, res) => {
  res.json(await readHolidays());
});

app.get("/api/employees", async (_req, res) => {
  res.json(await readEmployees());
});

app.get("/api/users", authMiddleware, async (_req, res) => {
  const users = await readUsers();
  const sanitized = users.map((u) => ({
    username: u.username,
    role: u.role,
    officeName: u.officeName,
    service: u.service
  }));
  res.json(sanitized);
});

app.post("/api/users", authMiddleware, requireRole("ADMIN"), async (req, res) => {
  const { username, password, role, officeName, service } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ error: "invalid_payload" });
  const users = await readUsers();
  if (users.find((u: any) => u.username === username)) return res.status(409).json({ error: "exists" });
  const payload = { username, password, role, officeName: officeName ?? null, service: service ?? null };
  users.push(payload);
  await writeUsers(users);
  res.status(201).json({ username, role, officeName: payload.officeName, service: payload.service });
});

app.put("/api/users/:username", authMiddleware, requireRole("ADMIN"), async (req, res) => {
  const users = await readUsers();
  const idx = users.findIndex((u: any) => u.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  const prev = users[idx];
  const next = {
    ...prev,
    role: req.body.role ?? prev.role,
    officeName: req.body.officeName ?? prev.officeName ?? null,
    service: req.body.service ?? prev.service ?? null,
    password: req.body.password ?? prev.password
  };
  users[idx] = next;
  await writeUsers(users);
  res.json({ username: next.username, role: next.role, officeName: next.officeName, service: next.service });
});

app.delete("/api/users/:username", authMiddleware, requireRole("ADMIN"), async (req, res) => {
  const users = await readUsers();
  const user = users.find((u: any) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "not_found" });
  if (String(user.role || "").replace(/^ROLE_/, "") === "ADMIN") {
    const adminCount = users.filter((u: any) => String(u.role || "").replace(/^ROLE_/, "") === "ADMIN").length;
    if (adminCount <= 1) return res.status(400).json({ error: "last_admin" });
  }
  const next = users.filter((u: any) => u.username !== req.params.username);
  await writeUsers(next);
  res.status(204).end();
});

app.post("/api/events", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), async (req, res) => {
  const events = await archivePastEvents(); // also ensures ids for current records
  const user = (req as any).user as any;
  const id = crypto.randomUUID();
  const payload = {
    id,
    ...req.body,
    createdBy: user?.sub || user?.username || null,
    createdByOffice: user?.officeName || null,
    createdAt: new Date().toISOString()
  };
  if (!("office" in payload) || payload.office == null) {
    payload.office = user?.officeName ?? null;
  }
  events.push(payload);
  await writeEvents(events);
  res.status(201).json(payload);
});

app.put("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), async (req, res) => {
  await archivePastEvents(); // move any past items first
  const events = await readEvents();
  const user = (req as any).user as any;
  const idx = events.findIndex((e: any) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  if (isEventPast(events[idx])) return res.status(409).json({ error: "event_archived_or_past" });
  const isAdmin = String(user?.role || "").replace(/^ROLE_/, "").endsWith("ADMIN");
  const userOffice = user?.officeName || null;
  const ownerOffice = events[idx]?.office ?? events[idx]?.createdByOffice ?? null;
  if (!isAdmin && (!ownerOffice || ownerOffice !== userOffice)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const updated = { ...events[idx], ...req.body, id: events[idx].id };
  events[idx] = updated;
  await writeEvents(events);
  res.json(updated);
});

app.delete("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), async (req, res) => {
  await archivePastEvents(); // move any past items first
  const events = await readEvents();
  const user = (req as any).user as any;
  const idx = events.findIndex((e: any) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  if (isEventPast(events[idx])) return res.status(409).json({ error: "event_archived_or_past" });
  const isAdmin = String(user?.role || "").replace(/^ROLE_/, "").endsWith("ADMIN");
  const userOffice = user?.officeName || null;
  const ownerOffice = events[idx]?.office ?? events[idx]?.createdByOffice ?? null;
  if (!isAdmin && (!ownerOffice || ownerOffice !== userOffice)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const next = events.filter((e: any) => e.id !== req.params.id);
  await writeEvents(next);
  res.status(204).end();
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`api listening on port ${port}`);
});
