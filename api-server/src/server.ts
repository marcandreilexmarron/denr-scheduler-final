import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { authMiddleware, signToken, requireRole, requireAnyRole } from "./auth.js";
import crypto from "crypto";
import { DateTime } from "luxon";
import { fileURLToPath } from "url";

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

function ensureEventIds(): any[] {
  const p = path.join(dataDir, "events.json");
  const events = readJson(p) as any[];
  let mutated = false;
  for (const ev of events) {
    if (!ev.id) {
      ev.id = crypto.randomUUID();
      mutated = true;
    }
  }
  if (mutated) {
    writeEventsFile(p, events);
  }
  return events;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

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

app.get("/api/calendar", (req, res) => {
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const now = DateTime.now();
  const ym = DateTime.fromObject({
    year: year ?? now.year,
    month: month ?? now.month,
    day: 1
  });
  const holidaysPath = path.join(dataDir, "holidays.json");
  const allHolidays = readJson(holidaysPath) as Array<{ month: number; day: number; name: string }>;
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

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const p = path.join(dataDir, "users.json");
  const users = readJson(p) as any[];
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

app.get("/api/events", (_req, res) => {
  const events = ensureEventIds();
  res.json(events);
});

app.get("/api/office/events", authMiddleware, (req, res) => {
  const user = (req as any).user as any;
  const events = ensureEventIds();
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

app.get("/api/holidays", (_req, res) => {
  const p = path.join(dataDir, "holidays.json");
  res.json(readJson(p));
});

app.get("/api/users", authMiddleware, (_req, res) => {
  const p = path.join(dataDir, "users.json");
  const users = readJson(p) as any[];
  const sanitized = users.map((u) => ({
    username: u.username,
    role: u.role,
    officeName: u.officeName,
    service: u.service
  }));
  res.json(sanitized);
});

app.post("/api/users", authMiddleware, requireRole("ADMIN"), (req, res) => {
  const { username, password, role, officeName, service } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ error: "invalid_payload" });
  const p = path.join(dataDir, "users.json");
  const users = readJson(p) as any[];
  if (users.find((u: any) => u.username === username)) return res.status(409).json({ error: "exists" });
  const payload = { username, password, role, officeName: officeName ?? null, service: service ?? null };
  users.push(payload);
  fs.writeFileSync(p, JSON.stringify(users, null, 2), "utf-8");
  res.status(201).json({ username, role, officeName: payload.officeName, service: payload.service });
});

app.put("/api/users/:username", authMiddleware, requireRole("ADMIN"), (req, res) => {
  const p = path.join(dataDir, "users.json");
  const users = readJson(p) as any[];
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
  fs.writeFileSync(p, JSON.stringify(users, null, 2), "utf-8");
  res.json({ username: next.username, role: next.role, officeName: next.officeName, service: next.service });
});

app.delete("/api/users/:username", authMiddleware, requireRole("ADMIN"), (req, res) => {
  const p = path.join(dataDir, "users.json");
  const users = readJson(p) as any[];
  const user = users.find((u: any) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "not_found" });
  if (String(user.role || "").replace(/^ROLE_/, "") === "ADMIN") {
    const adminCount = users.filter((u: any) => String(u.role || "").replace(/^ROLE_/, "") === "ADMIN").length;
    if (adminCount <= 1) return res.status(400).json({ error: "last_admin" });
  }
  const next = users.filter((u: any) => u.username !== req.params.username);
  fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
  res.status(204).end();
});

app.post("/api/events", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), (req, res) => {
  const p = path.join(dataDir, "events.json");
  const events = readJson(p) as any[];
  const user = (req as any).user as any;
  const id = crypto.randomUUID();
  const payload = { id, ...req.body };
  if (!("office" in payload) || payload.office == null) {
    payload.office = user?.officeName ?? null;
  }
  events.push(payload);
  writeEventsFile(p, events);
  res.status(201).json(payload);
});

app.put("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), (req, res) => {
  const p = path.join(dataDir, "events.json");
  const events = readJson(p) as any[];
  const idx = events.findIndex((e: any) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });
  const updated = { ...events[idx], ...req.body, id: events[idx].id };
  events[idx] = updated;
  writeEventsFile(p, events);
  res.json(updated);
});

app.delete("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), (req, res) => {
  const p = path.join(dataDir, "events.json");
  const events = readJson(p) as any[];
  const next = events.filter((e: any) => e.id !== req.params.id);
  if (next.length === events.length) return res.status(404).json({ error: "not_found" });
  writeEventsFile(p, next);
  res.status(204).end();
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`api listening on port ${port}`);
});
