import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { authMiddleware, signToken, signTokenWithExpiry, verifyToken, requireAnyRole } from "./auth.js";
import crypto from "crypto";
import { DateTime } from "luxon";
import { readEvents, writeEvents, readArchivedEvents, writeArchivedEvents, readUsers, readHolidays, writeHolidays, readEmployees, getDataDir, pingStorage } from "./storage-select.js";
import { sendEventCreatedEmail, sendReminderEmail, sendTwoFactorCodeEmail } from "./email-service.js";
import multer from "multer";
const app = express();
if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}
app.disable("x-powered-by");
const appTimeZone = String(process.env.APP_TIMEZONE || "").trim();
function nowTz() {
    return appTimeZone ? DateTime.now().setZone(appTimeZone) : DateTime.now();
}
function wrapAsync(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function patchAsyncRoutes(app) {
    for (const method of ["get", "post", "put", "delete", "patch", "options"]) {
        const orig = app[method].bind(app);
        app[method] = (path, ...handlers) => {
            const wrapped = handlers.map((h) => {
                if (typeof h !== "function")
                    return h;
                if (h.length >= 4)
                    return h;
                return wrapAsync(h);
            });
            return orig(path, ...wrapped);
        };
    }
}
patchAsyncRoutes(app);
function makeMutex() {
    let tail = Promise.resolve();
    return async function withLock(fn) {
        const prev = tail;
        let release;
        tail = new Promise((resolve) => { release = resolve; });
        await prev;
        try {
            return await fn();
        }
        finally {
            release?.();
        }
    };
}
const withEventsLock = makeMutex();
const withUsersLock = makeMutex();
const withHolidaysLock = makeMutex();
function setSecurityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
}
app.use(setSecurityHeaders);
function makeRateLimiter(opts) {
    const store = new Map();
    return (req, res, next) => {
        const now = Date.now();
        const k = String(opts.key(req) || req.ip || "unknown");
        const cur = store.get(k);
        if (!cur || now > cur.resetAt) {
            store.set(k, { resetAt: now + opts.windowMs, count: 1 });
            return next();
        }
        cur.count += 1;
        if (cur.count > opts.max) {
            return res.status(429).json({ error: "rate_limited" });
        }
        store.set(k, cur);
        if (store.size > 5000) {
            for (const [kk, vv] of store) {
                if (now > vv.resetAt)
                    store.delete(kk);
            }
        }
        next();
    };
}
const limitLogin = makeRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 40,
    key: (req) => `${req.ip}|login|${String(req.body?.username || "").trim().toLowerCase()}`
});
const limitVerify = makeRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 60,
    key: (req) => `${req.ip}|verify|${String(req.body?.tempToken || "").slice(0, 12)}`
});
const limitUpload = makeRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 120,
    key: (req) => `${req.ip}|upload|${String(req.user?.sub || "")}`
});
const loginFailStore = new Map();
function normUserKey(username) {
    return String(username || "").trim().toLowerCase();
}
function checkLoginLock(username) {
    const k = normUserKey(username);
    const rec = loginFailStore.get(k);
    const now = Date.now();
    if (rec && rec.lockUntil > now)
        return { locked: true, retryAfterMs: rec.lockUntil - now };
    return { locked: false, retryAfterMs: 0 };
}
function noteLoginFailure(username) {
    const k = normUserKey(username);
    if (!k)
        return;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const lockMs = 15 * 60 * 1000;
    const maxFails = 10;
    const prev = loginFailStore.get(k);
    const base = prev && now - prev.firstAt <= windowMs ? prev : { firstAt: now, fails: 0, lockUntil: 0 };
    base.fails += 1;
    if (base.fails >= maxFails)
        base.lockUntil = now + lockMs;
    loginFailStore.set(k, base);
    if (loginFailStore.size > 5000) {
        for (const [kk, vv] of loginFailStore) {
            if (vv.lockUntil > 0 && now > vv.lockUntil)
                loginFailStore.delete(kk);
            else if (now - vv.firstAt > windowMs && vv.lockUntil === 0)
                loginFailStore.delete(kk);
        }
    }
}
function clearLoginFailures(username) {
    const k = normUserKey(username);
    if (!k)
        return;
    loginFailStore.delete(k);
}
const corsOriginsRaw = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "").trim();
const frontendUrl = String(process.env.FRONTEND_URL || "").trim();
const corsAllowAll = corsOriginsRaw === "*";
const defaultCorsAllowList = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (frontendUrl)
    defaultCorsAllowList.unshift(frontendUrl);
const corsAllowList = corsOriginsRaw && !corsAllowAll
    ? corsOriginsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultCorsAllowList;
app.use(cors({
    origin: (origin, cb) => {
        if (!origin)
            return cb(null, true);
        if (corsAllowAll)
            return cb(null, true);
        if (corsAllowList.includes(origin))
            return cb(null, true);
        return cb(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.get("/api/health", async (_req, res) => {
    await pingStorage();
    res.json({ ok: true, at: new Date().toISOString() });
});
const uploadDir = path.join(getDataDir(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.get("/uploads/:filename", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), (req, res) => {
    const raw = String(req.params.filename || "");
    const filename = path.basename(raw);
    if (!filename || filename !== raw)
        return res.status(400).json({ error: "invalid_filename" });
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "not_found" });
    res.sendFile(filePath);
});
// Configure Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const safeOriginal = path.basename(String(file.originalname || "file")).replace(/[^\w.\- ]+/g, "_");
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeOriginal);
    }
});
const maxUploadBytes = (() => {
    const n = Number(process.env.MAX_UPLOAD_BYTES);
    return Number.isFinite(n) && n > 0 ? n : 10 * 1024 * 1024;
})();
const uploadMimeAllowlist = (() => {
    const raw = String(process.env.UPLOAD_MIME_ALLOWLIST || "").trim();
    if (raw)
        return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];
})();
const upload = multer({
    storage: storage,
    limits: { fileSize: maxUploadBytes },
    fileFilter: (_req, file, cb) => {
        const mt = String(file?.mimetype || "").trim().toLowerCase();
        if (mt && uploadMimeAllowlist.includes(mt))
            return cb(null, true);
        return cb(new Error("unsupported_file_type"));
    }
});
// Route to handle file upload
app.post("/api/upload", authMiddleware, requireAnyRole(["OFFICE", "ADMIN"]), limitUpload, upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    // Return the file info needed for the frontend
    // The 'url' will be relative to the server root, e.g., /uploads/filename.ext
    res.json({
        name: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size
    });
});
function parseDateTime(dateStr, timeStr) {
    if (!dateStr)
        return null;
    try {
        let y, m, d;
        if (dateStr instanceof Date) {
            y = dateStr.getFullYear();
            m = dateStr.getMonth() + 1;
            d = dateStr.getDate();
        }
        else {
            [y, m, d] = String(dateStr).split("-").map((n) => Number(n));
        }
        let hh = 23, mm = 59;
        if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
            const [h2, m2] = timeStr.split(":").map((n) => Number(n));
            hh = isFinite(h2) ? h2 : 23;
            mm = isFinite(m2) ? m2 : 59;
        }
        return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
    }
    catch {
        return null;
    }
}
function isEventPast(ev) {
    // Past = event's end time is before the current moment
    const now = new Date().getTime();
    if (ev?.dateType === "range" && ev?.startDate && ev?.endDate) {
        // If it's a range, use the endDate and endTime (default to end of day if no time specified)
        const end = parseDateTime(ev.endDate, ev.endTime) || parseDateTime(ev.endDate, "23:59");
        return (end?.getTime() ?? now) < now;
    }
    if (ev?.date) {
        // If it's a single day, use the date and endTime (default to end of day if no time specified)
        const end = parseDateTime(ev.date, ev.endTime || ev.startTime || "23:59");
        return (end?.getTime() ?? now) < now;
    }
    return false;
}
async function archivePastEvents() {
    const current = await readEvents();
    const events = current.map((e) => {
        if (!e.id)
            e.id = crypto.randomUUID();
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
async function backfillDivisionChiefTokens() {
    const events = await readEvents();
    const { services } = getServicesStructure();
    const divisionOffices = new Set((services ?? []).flatMap((svc) => (svc?.offices ?? []).map((o) => o.name)));
    let mutated = false;
    for (const ev of events) {
        const parts = Array.isArray(ev?.participants) ? ev.participants : [];
        const tokens = Array.isArray(ev?.participantTokens) ? ev.participantTokens : [];
        if (tokens.includes("Division Chiefs"))
            continue;
        if (divisionOffices.size === 0)
            continue;
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
    const divisionOffices = new Set((services ?? []).flatMap((svc) => (svc?.offices ?? []).map((o) => o.name)));
    let mutated = false;
    for (const ev of events) {
        const parts = Array.isArray(ev?.participants) ? ev.participants : [];
        const tokens = Array.isArray(ev?.participantTokens) ? ev.participantTokens : [];
        if (tokens.includes("Division Chiefs"))
            continue;
        if (divisionOffices.size === 0)
            continue;
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
const dataDir = getDataDir();
const adminAuditPath = path.join(dataDir, "admin-audit.json");
const adminSseClients = new Set();
const adminStreamTokens = new Map();
const twoFactorStore = new Map();
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000;
const TWO_FACTOR_ATTEMPTS = 5;
const TWO_FACTOR_RESEND_COOLDOWN_MS = 30 * 1000;
function maskEmail(email) {
    const e = String(email || "").trim();
    const at = e.indexOf("@");
    if (at <= 1)
        return "***";
    const name = e.slice(0, at);
    const domain = e.slice(at + 1);
    const first = name.slice(0, 1);
    const last = name.slice(-1);
    const maskedName = `${first}${"*".repeat(Math.min(6, Math.max(2, name.length - 2)))}${last}`;
    return `${maskedName}@${domain}`;
}
function hashTwoFactorCode(username, code) {
    return crypto.createHash("sha256").update(`${username}:${code}`).digest("hex");
}
function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
function verifyPassword(stored, password) {
    if (typeof stored !== "string" || !stored)
        return { ok: false, needsUpgrade: false };
    if (!stored.startsWith("scrypt$")) {
        return { ok: stored === password, needsUpgrade: stored === password };
    }
    const parts = stored.split("$");
    if (parts.length !== 3)
        return { ok: false, needsUpgrade: false };
    try {
        const salt = Buffer.from(parts[1], "base64url");
        const expected = Buffer.from(parts[2], "base64url");
        const actual = crypto.scryptSync(password, salt, expected.length);
        if (expected.length !== actual.length)
            return { ok: false, needsUpgrade: false };
        return { ok: crypto.timingSafeEqual(expected, actual), needsUpgrade: false };
    }
    catch {
        return { ok: false, needsUpgrade: false };
    }
}
function readAdminAudit() {
    if (!fs.existsSync(adminAuditPath)) {
        fs.writeFileSync(adminAuditPath, "[]", "utf-8");
        return [];
    }
    const raw = fs.readFileSync(adminAuditPath, "utf-8").trim();
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function appendAdminAudit(entry) {
    const existing = readAdminAudit();
    existing.unshift(entry);
    if (existing.length > 2000)
        existing.length = 2000;
    fs.writeFileSync(adminAuditPath, JSON.stringify(existing, null, 2), "utf-8");
}
function makeAuditEntry(user, action, meta) {
    return {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: user?.sub || null,
        actorRole: user?.role || null,
        action,
        meta: meta ?? null
    };
}
function adminBroadcast(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of adminSseClients) {
        try {
            res.write(data);
        }
        catch {
            adminSseClients.delete(res);
        }
    }
}
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
    const user = req.user;
    res.json(user);
});
app.get("/api/offices-data", (_req, res) => {
    res.json(getServicesStructure());
});
app.get("/api/calendar", async (req, res) => {
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const now = nowTz();
    const ym = appTimeZone
        ? DateTime.fromObject({ year: year ?? now.year, month: month ?? now.month, day: 1 }, { zone: appTimeZone })
        : DateTime.fromObject({ year: year ?? now.year, month: month ?? now.month, day: 1 });
    const allHolidays = (await readHolidays());
    const monthHolidays = allHolidays.filter((h) => h.month === ym.month);
    let firstDayOfWeek = ym.weekday; // 1=Mon..7=Sun
    if (firstDayOfWeek === 7)
        firstDayOfWeek = 0; // Sunday start adjustment
    const daysInMonth = ym.daysInMonth ?? 30;
    const today = ym.hasSame(now, "month") && ym.hasSame(now, "year") ? now.day : 0;
    const calendarDays = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDays.push({ day: "", isToday: false, holiday: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const holiday = monthHolidays.find((h) => h.day === d) ?? null;
        calendarDays.push({ day: d, isToday: d === today, holiday });
    }
    // Fill the grid to the end of the week
    while (calendarDays.length % 7 !== 0) {
        calendarDays.push({ day: "", isToday: false, holiday: null });
    }
    const prev = ym.minus({ months: 1 });
    const next = ym.plus({ months: 1 });
    res.json({
        year: ym.year,
        month: ym.month,
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
app.post("/api/login", limitLogin, async (req, res) => {
    await withUsersLock(async () => {
        const { username, password } = req.body || {};
        const lock = checkLoginLock(username);
        if (lock.locked)
            return res.status(429).json({ error: "account_locked", retryAfterMs: lock.retryAfterMs });
        const users = await readUsers();
        const user = users.find((u) => u.username === username);
        if (!user) {
            noteLoginFailure(username);
            return res.status(404).json({ error: "username_not_found" });
        }
        if (user.disabled)
            return res.status(403).json({ error: "user_disabled" });
        const pw = verifyPassword(user.password, String(password ?? ""));
        if (!pw.ok) {
            noteLoginFailure(username);
            return res.status(401).json({ error: "incorrect_password" });
        }
        clearLoginFailures(username);
        if (pw.needsUpgrade) {
            user.password = hashPassword(String(password ?? ""));
            await (await import("./storage-select.js")).writeUsers(users);
        }
        const isAdmin = String(user.role || "").includes("ADMIN");
        if (isAdmin) {
            const token = signToken({
                sub: user.username,
                role: user.role,
                officeName: user.officeName,
                service: user.service
            });
            return res.json({ token });
        }
        res.status(409).json({ error: "two_factor_required" });
    });
});
app.post("/api/login/start", limitLogin, async (req, res) => {
    await withUsersLock(async () => {
        const { username, password } = req.body || {};
        const lock = checkLoginLock(username);
        if (lock.locked)
            return res.status(429).json({ error: "account_locked", retryAfterMs: lock.retryAfterMs });
        const users = await readUsers();
        const user = users.find((u) => u.username === username);
        if (!user) {
            noteLoginFailure(username);
            return res.status(404).json({ error: "username_not_found" });
        }
        if (user.disabled)
            return res.status(403).json({ error: "user_disabled" });
        const pw = verifyPassword(user.password, String(password ?? ""));
        if (!pw.ok) {
            noteLoginFailure(username);
            return res.status(401).json({ error: "incorrect_password" });
        }
        clearLoginFailures(username);
        if (pw.needsUpgrade) {
            user.password = hashPassword(String(password ?? ""));
            await (await import("./storage-select.js")).writeUsers(users);
        }
        const isAdmin = String(user.role || "").includes("ADMIN");
        if (isAdmin) {
            const token = signToken({
                sub: user.username,
                role: user.role,
                officeName: user.officeName,
                service: user.service
            });
            return res.json({ token });
        }
        const email = String(user.email || "").trim();
        if (!isEmailLike(email))
            return res.status(400).json({ error: "email_required_for_2fa" });
        const prev = twoFactorStore.get(user.username);
        const now = Date.now();
        if (prev && now - prev.lastSentAt < TWO_FACTOR_RESEND_COOLDOWN_MS) {
            return res.status(429).json({ error: "two_factor_throttled" });
        }
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const record = {
            codeHash: hashTwoFactorCode(user.username, code),
            expiresAt: now + TWO_FACTOR_TTL_MS,
            attemptsLeft: TWO_FACTOR_ATTEMPTS,
            lastSentAt: now
        };
        twoFactorStore.set(user.username, record);
        try {
            await sendTwoFactorCodeEmail(email, user.username, code, Math.round(TWO_FACTOR_TTL_MS / 60000));
        }
        catch (err) {
            twoFactorStore.delete(user.username);
            return res.status(500).json({ error: "two_factor_email_failed" });
        }
        const tempToken = signTokenWithExpiry({
            sub: user.username,
            role: user.role,
            officeName: user.officeName,
            service: user.service,
            twoFactor: true
        }, "10m");
        res.json({ twoFactorRequired: true, tempToken, email: maskEmail(email) });
    });
});
app.post("/api/login/verify", limitVerify, async (req, res) => {
    const { tempToken, code } = req.body || {};
    if (typeof tempToken !== "string" || !tempToken.trim())
        return res.status(400).json({ error: "missing_temp_token" });
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim()))
        return res.status(400).json({ error: "invalid_code_format" });
    const decoded = verifyToken(tempToken.trim());
    if (!decoded || !decoded.twoFactor || typeof decoded.sub !== "string") {
        return res.status(401).json({ error: "invalid_temp_token" });
    }
    const username = String(decoded.sub);
    const record = twoFactorStore.get(username);
    if (!record)
        return res.status(410).json({ error: "two_factor_expired" });
    const now = Date.now();
    if (now > record.expiresAt) {
        twoFactorStore.delete(username);
        return res.status(410).json({ error: "two_factor_expired" });
    }
    if (record.attemptsLeft <= 0) {
        twoFactorStore.delete(username);
        return res.status(429).json({ error: "too_many_attempts" });
    }
    const ok = record.codeHash === hashTwoFactorCode(username, code.trim());
    if (!ok) {
        record.attemptsLeft -= 1;
        twoFactorStore.set(username, record);
        if (record.attemptsLeft <= 0) {
            twoFactorStore.delete(username);
            return res.status(429).json({ error: "too_many_attempts" });
        }
        return res.status(401).json({ error: "invalid_code" });
    }
    twoFactorStore.delete(username);
    const token = signToken({
        sub: username,
        role: decoded.role,
        officeName: decoded.officeName,
        service: decoded.service
    });
    res.json({ token });
});
function isHolidayDate(d, holidays) {
    return holidays.some((h) => h.month === d.getMonth() + 1 && h.day === d.getDate());
}
function parseYMD(s) {
    if (!s)
        return null;
    try {
        if (s instanceof Date)
            return new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const [y, m, d] = String(s).split("-").map((n) => Number(n));
        return new Date(y, (m || 1) - 1, d || 1);
    }
    catch {
        return null;
    }
}
function isHolidayOnlyEvent(ev, holidays) {
    if (ev?.dateType === "range" && ev?.startDate && ev?.endDate) {
        const start = parseYMD(ev.startDate);
        const end = parseYMD(ev.endDate);
        if (!start || !end)
            return false;
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
    try {
        await withEventsLock(async () => {
            await archivePastEvents();
            await backfillDivisionChiefTokens();
            await backfillDivisionChiefTokensArchive();
            const holidays = (await readHolidays());
            const simpleHolidays = holidays.map((h) => ({ month: h.month, day: h.day }));
            const events = (await readEvents()).filter((e) => !isHolidayOnlyEvent(e, simpleHolidays));
            res.json(events);
        });
    }
    catch (err) {
        console.error("Failed to read events:", err);
        res.status(500).json({ error: "failed_to_read_events" });
    }
});
app.get("/api/events/archive", async (_req, res) => {
    try {
        await withEventsLock(async () => {
            await archivePastEvents();
            await backfillDivisionChiefTokensArchive();
            const events = await readArchivedEvents();
            res.json(events);
        });
    }
    catch (err) {
        console.error("Failed to read archived events:", err);
        res.status(500).json({ error: "failed_to_read_archived_events" });
    }
});
app.get("/api/office/events", authMiddleware, async (req, res) => {
    try {
        await withEventsLock(async () => {
            await archivePastEvents();
            await backfillDivisionChiefTokens();
            await backfillDivisionChiefTokensArchive();
            const user = req.user;
            const holidays = (await readHolidays());
            const simpleHolidays = holidays.map((h) => ({ month: h.month, day: h.day }));
            const events = (await readEvents()).filter((e) => !isHolidayOnlyEvent(e, simpleHolidays));
            const { services } = getServicesStructure();
            const svc = services.find((s) => s.name === user.service);
            const serviceOfficeNames = new Set((svc?.offices ?? []).map((o) => o.name));
            const filtered = events.filter((e) => {
                if (e.office && e.office === user.officeName)
                    return true;
                if (Array.isArray(e.participants)) {
                    if (e.participants.includes(user.officeName))
                        return true;
                    for (const name of e.participants) {
                        if (serviceOfficeNames.has(name))
                            return true;
                    }
                }
                return false;
            });
            res.json(filtered);
        });
    }
    catch (err) {
        console.error("Failed to read office events:", err);
        res.status(500).json({ error: "failed_to_read_events" });
    }
});
function normalizeHolidaysList(input) {
    const map = new Map();
    for (const h of Array.isArray(input) ? input : []) {
        const m = Number(h?.month);
        const d = Number(h?.day);
        if (!Number.isFinite(m) || !Number.isFinite(d))
            continue;
        if (m < 1 || m > 12 || d < 1 || d > 31)
            continue;
        const key = `${m}-${d}`;
        const name = typeof h?.name === "string" ? h.name : undefined;
        map.set(key, { month: m, day: d, name });
    }
    return Array.from(map.values()).sort((a, b) => (a.month - b.month) || (a.day - b.day));
}
app.get("/api/holidays", async (_req, res) => {
    const holidays = await readHolidays();
    res.json(normalizeHolidaysList(holidays));
});
app.get("/api/employees", async (_req, res) => {
    res.json(await readEmployees());
});
app.post("/api/events", authMiddleware, requireAnyRole(["OFFICE"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            const events = await readEvents(); // Get current events directly
            const user = req.user;
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
            // Ensure attachments is valid array before saving
            if (req.body.attachments) {
                payload.attachments = req.body.attachments;
            }
            else {
                payload.attachments = [];
            }
            events.push(payload);
            await writeEvents(events);
            console.log("Event created successfully:", id);
            // Send email notification (fire and forget)
            sendEventCreatedEmail(payload).catch(err => console.error("Event created email error:", err));
            adminBroadcast({ type: "event.created", at: new Date().toISOString(), eventId: id, office: payload.office ?? null });
            res.status(201).json(payload);
        });
    }
    catch (err) {
        console.error("Failed to create event:", err);
        res.status(500).json({ error: "db_write_failed", message: err instanceof Error ? err.message : String(err) });
    }
});
app.put("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            await archivePastEvents();
            const events = await readEvents();
            const user = req.user;
            const idx = events.findIndex((e) => e.id === req.params.id);
            if (idx === -1)
                return res.status(404).json({ error: "not_found" });
            if (isEventPast(events[idx]))
                return res.status(409).json({ error: "event_archived_or_past" });
            const userOffice = user?.officeName || null;
            const ownerOffice = events[idx]?.office ?? events[idx]?.createdByOffice ?? null;
            if (!ownerOffice || ownerOffice !== userOffice) {
                return res.status(403).json({ error: "forbidden" });
            }
            const updated = { ...events[idx], ...req.body, id: events[idx].id };
            events[idx] = updated;
            await writeEvents(events);
            adminBroadcast({ type: "event.updated", at: new Date().toISOString(), eventId: updated.id, office: updated.office ?? null });
            res.json(updated);
        });
    }
    catch (err) {
        console.error("Failed to update event:", err);
        res.status(500).json({ error: "failed_to_update_event" });
    }
});
app.delete("/api/events/:id", authMiddleware, requireAnyRole(["OFFICE"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            await archivePastEvents();
            const events = await readEvents();
            const user = req.user;
            const idx = events.findIndex((e) => e.id === req.params.id);
            if (idx === -1)
                return res.status(404).json({ error: "not_found" });
            if (isEventPast(events[idx]))
                return res.status(409).json({ error: "event_archived_or_past" });
            const userOffice = user?.officeName || null;
            const ownerOffice = events[idx]?.office ?? events[idx]?.createdByOffice ?? null;
            if (!ownerOffice || ownerOffice !== userOffice) {
                return res.status(403).json({ error: "forbidden" });
            }
            const next = events.filter((e) => e.id !== req.params.id);
            await writeEvents(next);
            adminBroadcast({ type: "event.deleted", at: new Date().toISOString(), eventId: req.params.id, office: ownerOffice ?? null });
            res.status(204).end();
        });
    }
    catch (err) {
        console.error("Failed to delete event:", err);
        res.status(500).json({ error: "failed_to_delete_event" });
    }
});
// ====== SUPERADMIN ENDPOINTS ======
app.get("/api/admin/backup/export", authMiddleware, requireAnyRole(["ADMIN"]), async (_req, res) => {
    const snapshot = await buildBackupSnapshot();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="denr-scheduler-backup-${snapshot.at.replace(/[:.]/g, "-")}.json"`);
    res.json(snapshot);
});
app.post("/api/admin/backup/run", authMiddleware, requireAnyRole(["ADMIN"]), async (_req, res) => {
    const out = await runBackupNow();
    res.json(out);
});
app.get("/api/admin/backup/list", authMiddleware, requireAnyRole(["ADMIN"]), async (_req, res) => {
    ensureBackupDir();
    const files = fs.readdirSync(backupDir)
        .filter((f) => /^backup-.*\.json$/i.test(f))
        .map((f) => ({ file: f, modifiedAt: new Date(fs.statSync(path.join(backupDir, f)).mtimeMs).toISOString() }))
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    res.json({ dir: backupDir, files });
});
app.post("/api/admin/backup/restore", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    if (process.env.ENABLE_ADMIN_RESTORE !== "true") {
        return res.status(403).json({ error: "restore_disabled" });
    }
    const body = req.body || {};
    if (String(body.confirm || "") !== "RESTORE") {
        return res.status(400).json({ error: "missing_confirm" });
    }
    const file = typeof body.file === "string" ? body.file.trim() : "";
    const snapshot = body.snapshot;
    const loaded = (() => {
        if (file) {
            ensureBackupDir();
            const safe = path.basename(file);
            if (safe !== file)
                return null;
            const full = path.join(backupDir, safe);
            if (!fs.existsSync(full))
                return null;
            const raw = fs.readFileSync(full, "utf-8");
            return JSON.parse(raw);
        }
        if (snapshot && typeof snapshot === "object")
            return snapshot;
        return null;
    })();
    if (!loaded)
        return res.status(400).json({ error: "missing_backup" });
    const s = loaded;
    const events = Array.isArray(s.events) ? s.events : [];
    const archivedEvents = Array.isArray(s.archivedEvents) ? s.archivedEvents : [];
    const users = Array.isArray(s.users) ? s.users : [];
    const holidays = Array.isArray(s.holidays) ? s.holidays : [];
    if (body.dryRun === true) {
        return res.json({
            ok: true,
            dryRun: true,
            file: file || null,
            at: s.at ?? null,
            counts: { events: events.length, archivedEvents: archivedEvents.length, users: users.length, holidays: holidays.length }
        });
    }
    await withEventsLock(async () => {
        await withUsersLock(async () => {
            await withHolidaysLock(async () => {
                await writeEvents(events);
                await writeArchivedEvents(archivedEvents);
                await (await import("./storage-select.js")).writeUsers(users);
                await writeHolidays(holidays);
            });
        });
    });
    const actor = req.user;
    const audit = makeAuditEntry(actor, "backup.restored", { file: file || null, at: s.at ?? null });
    appendAdminAudit(audit);
    adminBroadcast({ type: "backup.restored", at: audit.at, file: file || null });
    res.json({
        ok: true,
        restoredAt: new Date().toISOString(),
        counts: { events: events.length, archivedEvents: archivedEvents.length, users: users.length, holidays: holidays.length }
    });
});
function normalizeEmailInput(v) {
    if (v == null)
        return null;
    if (typeof v !== "string")
        return null;
    const s = v.trim();
    return s ? s : null;
}
function isEmailLike(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function adminStreamAuth(req, res, next) {
    const st = typeof req.query?.st === "string" ? req.query.st.trim() : "";
    if (st) {
        const rec = adminStreamTokens.get(st);
        if (!rec)
            return res.status(401).json({ error: "invalid_stream_token" });
        if (Date.now() > rec.expiresAt) {
            adminStreamTokens.delete(st);
            return res.status(401).json({ error: "stream_token_expired" });
        }
        req.user = rec.user;
        return next();
    }
    return res.status(401).json({ error: "missing_stream_token" });
}
app.post("/api/admin/stream-token", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    const ttlMs = (() => {
        const n = Number(process.env.STREAM_TOKEN_TTL_MS);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2 * 60 * 1000;
    })();
    const streamToken = crypto.randomBytes(24).toString("base64url");
    adminStreamTokens.set(streamToken, { user: req.user, expiresAt: Date.now() + ttlMs });
    res.json({ streamToken, expiresInMs: ttlMs });
});
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of adminStreamTokens) {
        if (now > v.expiresAt)
            adminStreamTokens.delete(k);
    }
}, 60 * 1000);
app.get("/api/admin/stream", adminStreamAuth, requireAnyRole(["ADMIN"]), (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.write(`data: ${JSON.stringify({ type: "hello", at: new Date().toISOString() })}\n\n`);
    adminSseClients.add(res);
    const pingId = setInterval(() => {
        try {
            res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        }
        catch {
            adminSseClients.delete(res);
            clearInterval(pingId);
        }
    }, 25000);
    req.on("close", () => {
        clearInterval(pingId);
        adminSseClients.delete(res);
    });
});
app.get("/api/admin/audit", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    const limit = req.query.limit ? Math.max(1, Math.min(500, Number(req.query.limit))) : 50;
    const items = readAdminAudit().slice(0, limit);
    res.json(items);
});
// GET /api/admin/users - Get all users
app.get("/api/admin/users", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        const users = await readUsers();
        // Remove passwords before sending to client for security
        const safeUsers = users.map((u) => {
            const { password, ...rest } = u;
            return rest;
        });
        res.json(safeUsers);
    }
    catch (err) {
        console.error("Error reading users:", err);
        res.status(500).json({ error: "failed_to_read_users" });
    }
});
// POST /api/admin/users - Create a new user
app.post("/api/admin/users", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withUsersLock(async () => {
            const { username, password, role, officeName, service, email } = req.body || {};
            if (!username || !password || !role) {
                return res.status(400).json({ error: "missing_required_fields" });
            }
            const normalizedEmail = normalizeEmailInput(email);
            if (normalizedEmail && !isEmailLike(normalizedEmail)) {
                return res.status(400).json({ error: "invalid_email" });
            }
            const users = await readUsers();
            if (users.find((u) => u.username === username)) {
                return res.status(409).json({ error: "username_already_exists" });
            }
            if (normalizedEmail && users.some((u) => String(u.email || "").toLowerCase() === normalizedEmail.toLowerCase())) {
                return res.status(409).json({ error: "email_already_exists" });
            }
            const newUser = { username, password: hashPassword(String(password)), role, officeName, service, email: normalizedEmail ?? undefined, disabled: false };
            users.push(newUser);
            await (await import("./storage-select.js")).writeUsers(users);
            const { password: _, ...safeUser } = newUser;
            const actor = req.user;
            const audit = makeAuditEntry(actor, "user.created", { username, role, officeName: officeName ?? null, service: service ?? null, email: normalizedEmail ?? null });
            appendAdminAudit(audit);
            adminBroadcast({ type: "user.created", at: audit.at, username, role, officeName: officeName ?? null, service: service ?? null, email: normalizedEmail ?? null });
            res.status(201).json(safeUser);
        });
    }
    catch (err) {
        console.error("Error creating user:", err);
        res.status(500).json({ error: "failed_to_create_user" });
    }
});
// PUT /api/admin/users/:username - Update a user
app.put("/api/admin/users/:username", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withUsersLock(async () => {
            const { username } = req.params;
            const updates = req.body || {};
            const users = await readUsers();
            const idx = users.findIndex((u) => u.username === username);
            if (idx === -1)
                return res.status(404).json({ error: "user_not_found" });
            const nextUpdates = { ...updates };
            if ("email" in nextUpdates) {
                const normalizedEmail = normalizeEmailInput(nextUpdates.email);
                if (normalizedEmail && !isEmailLike(normalizedEmail)) {
                    return res.status(400).json({ error: "invalid_email" });
                }
                if (normalizedEmail && users.some((u) => u.username !== username && String(u.email || "").toLowerCase() === normalizedEmail.toLowerCase())) {
                    return res.status(409).json({ error: "email_already_exists" });
                }
                if (!normalizedEmail) {
                    delete nextUpdates.email;
                    users[idx].email = undefined;
                }
                else {
                    nextUpdates.email = normalizedEmail;
                }
            }
            const updated = { ...users[idx], ...nextUpdates, username };
            users[idx] = updated;
            await (await import("./storage-select.js")).writeUsers(users);
            const { password: _, ...safeUser } = updated;
            const actor = req.user;
            const audit = makeAuditEntry(actor, "user.updated", {
                username,
                role: safeUser.role ?? null,
                officeName: safeUser.officeName ?? null,
                service: safeUser.service ?? null,
                email: safeUser.email ?? null,
                disabled: !!safeUser.disabled
            });
            appendAdminAudit(audit);
            adminBroadcast({
                type: "user.updated",
                at: audit.at,
                username,
                role: safeUser.role ?? null,
                officeName: safeUser.officeName ?? null,
                service: safeUser.service ?? null,
                email: safeUser.email ?? null,
                disabled: !!safeUser.disabled
            });
            res.json(safeUser);
        });
    }
    catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ error: "failed_to_update_user" });
    }
});
app.post("/api/admin/users/:username/reset-password", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withUsersLock(async () => {
            const { username } = req.params;
            const body = req.body || {};
            const provided = typeof body.password === "string" ? body.password.trim() : "";
            const newPassword = provided || crypto.randomBytes(9).toString("base64url");
            const users = await readUsers();
            const idx = users.findIndex((u) => u.username === username);
            if (idx === -1)
                return res.status(404).json({ error: "user_not_found" });
            users[idx] = { ...users[idx], password: hashPassword(newPassword) };
            await (await import("./storage-select.js")).writeUsers(users);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "user.password_reset", { username });
            appendAdminAudit(audit);
            adminBroadcast({ type: "user.password_reset", at: audit.at, username });
            res.json({ username, password: newPassword });
        });
    }
    catch (err) {
        console.error("Error resetting password:", err);
        res.status(500).json({ error: "failed_to_reset_password" });
    }
});
// DELETE /api/admin/users/:username - Delete a user
app.delete("/api/admin/users/:username", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withUsersLock(async () => {
            const { username } = req.params;
            const users = await readUsers();
            const remaining = users.filter((u) => u.username !== username);
            if (remaining.length === users.length) {
                return res.status(404).json({ error: "user_not_found" });
            }
            await (await import("./storage-select.js")).writeUsers(remaining);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "user.deleted", { username });
            appendAdminAudit(audit);
            adminBroadcast({ type: "user.deleted", at: audit.at, username });
            res.status(204).end();
        });
    }
    catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "failed_to_delete_user" });
    }
});
// GET /api/admin/events - Get all events (admin view)
app.get("/api/admin/events", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        const events = await readEvents();
        res.json(events.map((e) => ({
            ...e,
            // Include all event details for admin view
        })));
    }
    catch (err) {
        console.error("Error reading events:", err);
        res.status(500).json({ error: "failed_to_read_events" });
    }
});
// GET /api/admin/events/archived - Get all archived events (admin view)
app.get("/api/admin/events/archived", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        const events = await readArchivedEvents();
        res.json(events);
    }
    catch (err) {
        console.error("Error reading archived events:", err);
        res.status(500).json({ error: "failed_to_read_archived_events" });
    }
});
// DELETE /api/admin/events/:id - Delete any event (admin only)
app.delete("/api/admin/events/:id", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            const events = await readEvents();
            const remaining = events.filter((e) => e.id !== req.params.id);
            if (remaining.length === events.length) {
                return res.status(404).json({ error: "event_not_found" });
            }
            await writeEvents(remaining);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "admin.event.deleted", { eventId: req.params.id });
            appendAdminAudit(audit);
            adminBroadcast({ type: "admin.event.deleted", at: audit.at, eventId: req.params.id });
            res.status(204).end();
        });
    }
    catch (err) {
        console.error("Error deleting event:", err);
        res.status(500).json({ error: "failed_to_delete_event" });
    }
});
// DELETE /api/admin/events/archived/:id - Delete archived event (admin only)
app.delete("/api/admin/events/archived/:id", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            const events = await readArchivedEvents();
            const remaining = events.filter((e) => e.id !== req.params.id);
            if (remaining.length === events.length) {
                return res.status(404).json({ error: "event_not_found" });
            }
            await writeArchivedEvents(remaining);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "admin.archived_event.deleted", { eventId: req.params.id });
            appendAdminAudit(audit);
            adminBroadcast({ type: "admin.archived_event.deleted", at: audit.at, eventId: req.params.id });
            res.status(204).end();
        });
    }
    catch (err) {
        console.error("Error deleting archived event:", err);
        res.status(500).json({ error: "failed_to_delete_archived_event" });
    }
});
// PUT /api/admin/events/:id - Update any event (admin only)
app.put("/api/admin/events/:id", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withEventsLock(async () => {
            const events = await readEvents();
            const idx = events.findIndex((e) => e.id === req.params.id);
            if (idx === -1)
                return res.status(404).json({ error: "not_found" });
            const updated = { ...events[idx], ...req.body, id: events[idx].id };
            events[idx] = updated;
            await writeEvents(events);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "admin.event.updated", { eventId: updated.id });
            appendAdminAudit(audit);
            adminBroadcast({ type: "admin.event.updated", at: audit.at, eventId: updated.id });
            res.json(updated);
        });
    }
    catch (err) {
        console.error("Error updating event:", err);
        res.status(500).json({ error: "failed_to_update_event" });
    }
});
// GET /api/admin/holidays - Get all holidays
app.get("/api/admin/holidays", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        const holidays = await readHolidays();
        res.json(normalizeHolidaysList(holidays));
    }
    catch (err) {
        console.error("Error reading holidays:", err);
        res.status(500).json({ error: "failed_to_read_holidays" });
    }
});
// POST /api/admin/holidays - Add a holiday
app.post("/api/admin/holidays", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withHolidaysLock(async () => {
            const { month, day, name } = req.body || {};
            const m = Number(month);
            const d = Number(day);
            if (!Number.isFinite(m) || !Number.isFinite(d)) {
                return res.status(400).json({ error: "missing_required_fields" });
            }
            const holidays = await readHolidays();
            const normalized = normalizeHolidaysList(holidays);
            if (normalized.some((h) => h.month === m && h.day === d)) {
                return res.status(409).json({ error: "holiday_already_exists" });
            }
            const holiday = { month: m, day: d, name };
            const next = normalizeHolidaysList([...normalized, holiday]);
            await writeHolidays(next);
            const actor = req.user;
            const audit = makeAuditEntry(actor, "holiday.created", { month: m, day: d, name: name ?? null });
            appendAdminAudit(audit);
            adminBroadcast({ type: "holiday.created", at: audit.at, month: m, day: d, name: name ?? null });
            res.status(201).json(holiday);
        });
    }
    catch (err) {
        console.error("Error creating holiday:", err);
        res.status(500).json({ error: "failed_to_create_holiday" });
    }
});
// DELETE /api/admin/holidays/:month/:day - Delete a holiday
app.delete("/api/admin/holidays/:month/:day", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withHolidaysLock(async () => {
            const { month, day } = req.params;
            const m = Number(month);
            const d = Number(day);
            const holidays = await readHolidays();
            const remaining = holidays.filter((h) => !(h.month === m && h.day === d));
            if (remaining.length === holidays.length) {
                return res.status(404).json({ error: "holiday_not_found" });
            }
            await writeHolidays(normalizeHolidaysList(remaining));
            const actor = req.user;
            const audit = makeAuditEntry(actor, "holiday.deleted", { month: m, day: d });
            appendAdminAudit(audit);
            adminBroadcast({ type: "holiday.deleted", at: audit.at, month: m, day: d });
            res.status(204).end();
        });
    }
    catch (err) {
        console.error("Error deleting holiday:", err);
        res.status(500).json({ error: "failed_to_delete_holiday" });
    }
});
// PUT /api/admin/holidays/:month/:day - Edit a holiday
app.put("/api/admin/holidays/:month/:day", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        await withHolidaysLock(async () => {
            const { month, day } = req.params;
            const fromMonth = Number(month);
            const fromDay = Number(day);
            if (!Number.isFinite(fromMonth) || !Number.isFinite(fromDay)) {
                return res.status(400).json({ error: "invalid_params" });
            }
            const { month: nextMonthRaw, day: nextDayRaw, name } = req.body || {};
            const toMonth = Number(nextMonthRaw);
            const toDay = Number(nextDayRaw);
            if (!toMonth || !toDay) {
                return res.status(400).json({ error: "missing_required_fields" });
            }
            if (!Number.isFinite(toMonth) || !Number.isFinite(toDay) || toMonth < 1 || toMonth > 12 || toDay < 1 || toDay > 31) {
                return res.status(400).json({ error: "invalid_date" });
            }
            const holidaysRaw = await readHolidays();
            const holidays = normalizeHolidaysList(holidaysRaw);
            const idx = holidays.findIndex((h) => h.month === fromMonth && h.day === fromDay);
            if (idx === -1) {
                return res.status(404).json({ error: "holiday_not_found" });
            }
            const collision = holidays.some((h, i) => i !== idx && h.month === toMonth && h.day === toDay);
            if (collision) {
                return res.status(409).json({ error: "holiday_already_exists" });
            }
            const updated = { month: toMonth, day: toDay, name };
            holidays[idx] = updated;
            await writeHolidays(normalizeHolidaysList(holidays));
            const actor = req.user;
            const audit = makeAuditEntry(actor, "holiday.updated", { from: { month: fromMonth, day: fromDay }, to: { month: toMonth, day: toDay }, name: name ?? null });
            appendAdminAudit(audit);
            adminBroadcast({ type: "holiday.updated", at: audit.at, fromMonth, fromDay, month: toMonth, day: toDay, name: name ?? null });
            res.json(updated);
        });
    }
    catch (err) {
        console.error("Error updating holiday:", err);
        res.status(500).json({ error: "failed_to_update_holiday" });
    }
});
// GET /api/admin/stats - Get system statistics
app.get("/api/admin/stats", authMiddleware, requireAnyRole(["ADMIN"]), async (req, res) => {
    try {
        const users = await readUsers();
        const events = await readEvents();
        const archivedEvents = await readArchivedEvents();
        const holidays = await readHolidays();
        const stats = {
            totalUsers: users.length,
            adminUsers: users.filter((u) => String(u.role || "").includes("ADMIN")).length,
            officeUsers: users.filter((u) => String(u.role || "").includes("OFFICE")).length,
            totalEvents: events.length,
            totalArchivedEvents: archivedEvents.length,
            totalHolidays: holidays.length,
            usersByOffice: {},
            eventsByOffice: {}
        };
        // Count users by office
        for (const user of users) {
            if (user.officeName) {
                stats.usersByOffice[user.officeName] = (stats.usersByOffice[user.officeName] || 0) + 1;
            }
        }
        // Count events by office
        for (const event of events) {
            if (event.office) {
                stats.eventsByOffice[event.office] = (stats.eventsByOffice[event.office] || 0) + 1;
            }
        }
        res.json(stats);
    }
    catch (err) {
        console.error("Error getting stats:", err);
        res.status(500).json({ error: "failed_to_get_stats" });
    }
});
// Reminder Scheduler
async function runReminderScheduler() {
    try {
        await withEventsLock(async () => {
            const events = await readEvents();
            const now = nowTz();
            const REMINDER_3D = 1;
            const REMINDER_1D = 2;
            const REMINDER_1H = 4;
            const targetDate3d = now.plus({ days: 3 }).toISODate();
            const targetDate1d = now.plus({ days: 1 }).toISODate();
            let mutated = false;
            for (const ev of events) {
                const currentMask = (() => {
                    const n = Number(ev.reminderSentMask);
                    if (Number.isFinite(n))
                        return n;
                    return ev.reminderSent ? REMINDER_3D : 0;
                })();
                let eventDate = null;
                if (ev.dateType === "range" && ev.startDate) {
                    eventDate = ev.startDate;
                }
                else if (ev.date) {
                    eventDate = ev.date;
                }
                if (!eventDate)
                    continue;
                let nextMask = currentMask;
                if (eventDate === targetDate3d && (nextMask & REMINDER_3D) === 0) {
                    console.log(`Sending 3-day reminder for event: "${ev.title}" (ID: ${ev.id})`);
                    await sendReminderEmail(ev, { daysAhead: 3 }).catch(err => console.error("Reminder email error:", err));
                    nextMask |= REMINDER_3D;
                }
                if (eventDate === targetDate1d && (nextMask & REMINDER_1D) === 0) {
                    console.log(`Sending 1-day reminder for event: "${ev.title}" (ID: ${ev.id})`);
                    await sendReminderEmail(ev, { daysAhead: 1 }).catch(err => console.error("Reminder email error:", err));
                    nextMask |= REMINDER_1D;
                }
                if ((nextMask & REMINDER_1H) === 0) {
                    const startDateStr = ev.dateType === "range" ? ev.startDate : ev.date;
                    const startTimeStr = typeof ev.startTime === "string" ? ev.startTime : "";
                    if (startDateStr && /^\d{2}:\d{2}$/.test(startTimeStr)) {
                        const start = parseDateTime(startDateStr, startTimeStr);
                        if (start) {
                            const diffMinutes = (start.getTime() - Date.now()) / 60000;
                            if (diffMinutes >= 58 && diffMinutes <= 62) {
                                console.log(`Sending 1-hour reminder for event: "${ev.title}" (ID: ${ev.id})`);
                                await sendReminderEmail(ev, { hoursAhead: 1 }).catch(err => console.error("Reminder email error:", err));
                                nextMask |= REMINDER_1H;
                            }
                        }
                    }
                }
                if (nextMask !== currentMask) {
                    ev.reminderSentMask = nextMask;
                    ev.reminderSent = (nextMask & REMINDER_3D) === REMINDER_3D;
                    mutated = true;
                }
            }
            if (mutated) {
                await writeEvents(events);
            }
        });
    }
    catch (err) {
        console.error("Scheduler error:", err);
    }
}
// Background Archive Scheduler
async function runArchiveScheduler() {
    try {
        console.log("Running background archive check...");
        await withEventsLock(async () => {
            await archivePastEvents();
        });
    }
    catch (err) {
        console.error("Archive scheduler error:", err);
    }
}
async function migratePlaintextPasswords() {
    try {
        await withUsersLock(async () => {
            const users = await readUsers();
            let mutated = false;
            for (const u of users) {
                const pw = u?.password;
                if (typeof pw === "string" && pw && !pw.startsWith("scrypt$")) {
                    u.password = hashPassword(pw);
                    mutated = true;
                }
            }
            if (mutated) {
                await (await import("./storage-select.js")).writeUsers(users);
            }
        });
    }
    catch (err) {
        console.error("Password migration error:", err);
    }
}
async function buildBackupSnapshot() {
    const [events, archivedEvents, users, holidays, employees] = await Promise.all([
        readEvents(),
        readArchivedEvents(),
        readUsers(),
        readHolidays(),
        readEmployees()
    ]);
    return {
        at: new Date().toISOString(),
        backend: String(process.env.DATA_BACKEND || "db"),
        events,
        archivedEvents,
        users,
        holidays,
        employees
    };
}
const backupDir = path.join(getDataDir(), "backups");
function ensureBackupDir() {
    if (!fs.existsSync(backupDir))
        fs.mkdirSync(backupDir, { recursive: true });
}
function copyDirRecursive(src, dst) {
    if (!fs.existsSync(src))
        return;
    if (!fs.existsSync(dst))
        fs.mkdirSync(dst, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const ent of entries) {
        const from = path.join(src, ent.name);
        const to = path.join(dst, ent.name);
        if (ent.isDirectory()) {
            copyDirRecursive(from, to);
        }
        else if (ent.isFile()) {
            fs.copyFileSync(from, to);
        }
    }
}
async function runBackupNow() {
    return await withEventsLock(async () => {
        return await withUsersLock(async () => {
            return await withHolidaysLock(async () => {
                ensureBackupDir();
                const snapshot = await buildBackupSnapshot();
                const safeAt = snapshot.at.replace(/[:.]/g, "-");
                const tmp = path.join(backupDir, `backup-${safeAt}.json.tmp`);
                const out = path.join(backupDir, `backup-${safeAt}.json`);
                fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
                fs.renameSync(tmp, out);
                const includeUploads = process.env.BACKUP_INCLUDE_UPLOADS === "true";
                const uploadsSrc = path.join(getDataDir(), "uploads");
                const uploadsDst = path.join(backupDir, `backup-${safeAt}-uploads`);
                if (includeUploads) {
                    try {
                        copyDirRecursive(uploadsSrc, uploadsDst);
                    }
                    catch (err) {
                        console.error("Backup uploads copy error:", err);
                    }
                }
                const keep = (() => {
                    const n = Number(process.env.BACKUP_KEEP);
                    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
                })();
                const files = fs.readdirSync(backupDir)
                    .filter((f) => /^backup-.*\.json$/i.test(f))
                    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
                    .sort((a, b) => b.t - a.t);
                for (const extra of files.slice(keep)) {
                    try {
                        fs.unlinkSync(path.join(backupDir, extra.f));
                    }
                    catch { }
                    try {
                        const base = extra.f.replace(/\.json$/i, "");
                        const dir = path.join(backupDir, `${base}-uploads`);
                        if (fs.existsSync(dir))
                            fs.rmSync(dir, { recursive: true, force: true });
                    }
                    catch { }
                }
                return { ok: true, file: out, at: snapshot.at, includeUploads };
            });
        });
    });
}
async function runPeriodicBackup() {
    try {
        const result = await runBackupNow();
        if (result && result.ok) {
            console.log("Backup saved:", result.file);
        }
    }
    catch (err) {
        console.error("Backup error:", err);
    }
}
setTimeout(migratePlaintextPasswords, 0);
setTimeout(runPeriodicBackup, 2000);
setInterval(runPeriodicBackup, 24 * 60 * 60 * 1000);
// Run archive scheduler every 10 minutes
setInterval(runArchiveScheduler, 10 * 60 * 1000);
// Also run archive on startup after a short delay
setTimeout(runArchiveScheduler, 5000);
// Run reminder scheduler every 5 minutes (needed for 1-hour reminders)
setInterval(runReminderScheduler, 5 * 60 * 1000);
// Also run reminder on startup after a short delay
setTimeout(runReminderScheduler, 10000);
app.use((err, _req, res, _next) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
        if (msg === "CORS blocked")
            return res.status(403).json({ error: "cors_blocked" });
        if (msg && /file too large/i.test(msg))
            return res.status(413).json({ error: "file_too_large" });
        if (msg === "unsupported_file_type")
            return res.status(415).json({ error: "unsupported_file_type" });
        return res.status(500).json({ error: "internal_error" });
    }
});
const port = Number(process.env.PORT || 3000);
const host = String(process.env.BIND_HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0"));
app.listen(port, host, () => {
    console.log(`api listening on ${host}:${port}`);
});
