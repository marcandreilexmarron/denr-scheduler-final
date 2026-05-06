import knex from "knex";
let _knex = null;
function getKnex() {
    if (_knex)
        return _knex;
    const client = (process.env.DATABASE_CLIENT || "").trim();
    const connection = (process.env.DATABASE_URL || "").trim();
    if (!client || !connection) {
        throw new Error("DATABASE_CLIENT and DATABASE_URL must be set for DB backend");
    }
    _knex = knex({
        client,
        connection,
        pool: { min: 0, max: 10 }
    });
    return _knex;
}
export async function ping() {
    const k = getKnex();
    await k.raw("select 1");
}
function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
async function syncByKey(trx, table, key, rows) {
    const desiredKeys = rows.map((r) => r?.[key]).filter((v) => v != null).map((v) => String(v));
    const desiredSet = new Set(desiredKeys);
    if (desiredKeys.length === 0) {
        await trx(table).del();
        return;
    }
    const existingRows = await trx(table).select([key]);
    const existingKeys = existingRows.map((r) => String(r?.[key]));
    const toDelete = existingKeys.filter((k) => !desiredSet.has(k));
    for (const ids of chunk(toDelete, 500)) {
        await trx(table).whereIn(key, ids).del();
    }
    for (const batch of chunk(rows, 100)) {
        await trx(table).insert(batch).onConflict(key).merge();
    }
}
export function getDataDir() {
    // Unused for DB backend; return empty string for compatibility
    return "";
}
const TABLE_PREFIX = String(process.env.DB_TABLE_PREFIX ?? "scheduler_").trim() || "scheduler_";
function tableName(base) {
    if (!TABLE_PREFIX)
        return base;
    return base.startsWith(TABLE_PREFIX) ? base : `${TABLE_PREFIX}${base}`;
}
function parseJson(v, fallback) {
    try {
        if (v == null)
            return fallback;
        if (typeof v !== "string")
            return v;
        return JSON.parse(v);
    }
    catch {
        return fallback;
    }
}
function toDbJson(v) {
    if (v == null)
        return null;
    if (typeof v === "string")
        return v;
    return JSON.stringify(v);
}
// Helpers for event mapping
function mapEventFromDb(r) {
    const { date_type, start_date, end_date, start_time, end_time, participant_tokens, created_by, created_by_office, created_at, category_detail, type, reminder_sent, ...rest } = r;
    const reminderSentMask = (() => {
        const n = Number(reminder_sent);
        if (Number.isFinite(n))
            return n;
        return reminder_sent ? 1 : 0;
    })();
    return {
        ...rest,
        dateType: date_type,
        startDate: start_date,
        endDate: end_date,
        startTime: start_time,
        endTime: end_time,
        participantTokens: parseJson(participant_tokens, []),
        participants: parseJson(r.participants, []),
        attachments: parseJson(r.attachments, []),
        createdBy: created_by,
        createdByOffice: created_by_office,
        createdAt: created_at,
        categoryDetail: category_detail,
        type: type,
        reminderSentMask,
        reminderSent: (reminderSentMask & 1) === 1
    };
}
function mapEventToDb(e) {
    const { dateType, startDate, endDate, startTime, endTime, participantTokens, participants, attachments, createdBy, createdByOffice, createdAt, categoryDetail, type, reminderSent, reminderSentMask, 
    // Extract unknown properties to prevent inserting them into the DB
    referToAttachments, _participantInput, ...rest } = e;
    // Basic sanitization
    const safeDate = (d) => (d === "" ? null : d);
    const nextReminderSentMask = (() => {
        const n = Number(reminderSentMask);
        if (Number.isFinite(n))
            return n;
        return reminderSent ? 1 : 0;
    })();
    return {
        ...rest,
        date_type: dateType,
        start_date: safeDate(startDate),
        end_date: safeDate(endDate),
        start_time: startTime || null,
        end_time: endTime || null,
        participant_tokens: toDbJson(participantTokens),
        participants: toDbJson(participants),
        attachments: toDbJson(attachments),
        created_by: createdBy,
        created_by_office: createdByOffice,
        created_at: createdAt,
        category_detail: categoryDetail || null,
        type: type || null,
        reminder_sent: nextReminderSentMask
    };
}
export async function readEvents() {
    const k = getKnex();
    const rows = await k(tableName("events")).select("*");
    return rows.map(mapEventFromDb);
}
export async function writeEvents(events) {
    const k = getKnex();
    try {
        await k.transaction(async (trx) => {
            const rows = events.map(mapEventToDb);
            await syncByKey(trx, tableName("events"), "id", rows);
        });
    }
    catch (err) {
        console.error("Error writing events:", err);
        throw err; // Propagate error so the API can return 500
    }
}
export async function readArchivedEvents() {
    const k = getKnex();
    const rows = await k(tableName("events_archive")).select("*");
    return rows.map(mapEventFromDb);
}
export async function writeArchivedEvents(events) {
    const k = getKnex();
    try {
        await k.transaction(async (trx) => {
            const rows = events.map(mapEventToDb);
            await syncByKey(trx, tableName("events_archive"), "id", rows);
        });
    }
    catch (err) {
        console.error("Error writing archived events:", err);
        throw err;
    }
}
export async function readUsers() {
    const k = getKnex();
    const rows = await k(tableName("office_users")).select("*");
    return rows.map((r) => {
        const { office_name, ...rest } = r;
        return { ...rest, officeName: office_name };
    });
}
export async function writeUsers(users) {
    const k = getKnex();
    try {
        await k.transaction(async (trx) => {
            const rows = users.map((u) => {
                const { officeName, ...rest } = u;
                return { ...rest, office_name: officeName };
            });
            await syncByKey(trx, tableName("office_users"), "username", rows);
        });
    }
    catch (err) {
        console.error("Error writing users:", err);
        throw err;
    }
}
export async function readHolidays() {
    const k = getKnex();
    const rows = await k(tableName("holidays")).select(["month", "day", "name"]);
    return rows;
}
export async function writeHolidays(holidays) {
    const k = getKnex();
    try {
        await k.transaction(async (trx) => {
            await trx(tableName("holidays")).del();
            if (holidays.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < holidays.length; i += chunkSize) {
                    await trx(tableName("holidays")).insert(holidays.slice(i, i + chunkSize));
                }
            }
        });
    }
    catch (err) {
        console.error("Error writing holidays:", err);
    }
}
export async function readEmployees() {
    const k = getKnex();
    const rows = await k(tableName("employee_details")).select("*");
    return rows.map((r) => {
        const { division, ...rest } = r;
        return { ...rest, officeName: division };
    });
}
