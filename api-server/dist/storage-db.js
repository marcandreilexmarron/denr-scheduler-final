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
export function getDataDir() {
    // Unused for DB backend; return empty string for compatibility
    return "";
}
const TABLE_PREFIX = (process.env.DB_TABLE_PREFIX || "scheduler_").trim();
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
        reminderSent: !!reminder_sent
    };
}
function mapEventToDb(e) {
    const { dateType, startDate, endDate, startTime, endTime, participantTokens, participants, attachments, createdBy, createdByOffice, createdAt, categoryDetail, type, reminderSent, 
    // Extract unknown properties to prevent inserting them into the DB
    _participantInput, ...rest } = e;
    // Basic sanitization
    const safeDate = (d) => (d === "" ? null : d);
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
        reminder_sent: reminderSent ? 1 : 0
    };
}
export async function readEvents() {
    const k = getKnex();
    try {
        const rows = await k(tableName("events")).select("*");
        return rows.map(mapEventFromDb);
    }
    catch (err) {
        console.error("Error reading events:", err);
        return [];
    }
}
export async function writeEvents(events) {
    const k = getKnex();
    try {
        await k.transaction(async (trx) => {
            // Warning: This full-replace strategy is dangerous for concurrency.
            // Ideally, we should switch to insert-on-conflict or per-event upsert.
            await trx(tableName("events")).del();
            if (events.length > 0) {
                const rows = events.map(mapEventToDb);
                const chunkSize = 100;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    await trx(tableName("events")).insert(rows.slice(i, i + chunkSize));
                }
            }
        });
    }
    catch (err) {
        console.error("Error writing events:", err);
        throw err; // Propagate error so the API can return 500
    }
}
export async function readArchivedEvents() {
    const k = getKnex();
    try {
        const rows = await k(tableName("events_archive")).select("*");
        return rows.map(mapEventFromDb);
    }
    catch (err) {
        console.error("Error reading archived events:", err);
        return [];
    }
}
export async function writeArchivedEvents(events) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx(tableName("events_archive")).del();
        if (events.length > 0) {
            const rows = events.map(mapEventToDb);
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                await trx(tableName("events_archive")).insert(rows.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readUsers() {
    const k = getKnex();
    try {
        const rows = await k(tableName("office_users")).select("*");
        return rows.map((r) => {
            const { office_name, ...rest } = r;
            return { ...rest, officeName: office_name };
        });
    }
    catch (err) {
        console.error("Error reading users:", err);
        return [];
    }
}
export async function writeUsers(users) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx(tableName("office_users")).del();
        if (users.length > 0) {
            const rows = users.map((u) => {
                const { officeName, ...rest } = u;
                return { ...rest, office_name: officeName };
            });
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                await trx(tableName("office_users")).insert(rows.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readHolidays() {
    const k = getKnex();
    try {
        const rows = await k(tableName("holidays")).select(["month", "day", "name"]);
        return rows;
    }
    catch (err) {
        console.error("Error reading holidays:", err);
        return [];
    }
}
export async function writeHolidays(holidays) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx(tableName("holidays")).del();
        if (holidays.length > 0) {
            const rows = holidays.map((h) => ({
                month: Number(h?.month),
                day: Number(h?.day),
                name: h?.name ? String(h.name) : null
            }));
            const chunkSize = 200;
            for (let i = 0; i < rows.length; i += chunkSize) {
                await trx(tableName("holidays")).insert(rows.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readEmployees() {
    const k = getKnex();
    try {
        // Map employee_details columns to expected structure
        // Expected: { name, officeName, ... }
        const rows = await k(tableName("employee_details")).select("*");
        return rows.map((r) => {
            const { division, ...rest } = r;
            // Map 'division' from DB to 'officeName' for the app
            return { ...rest, officeName: division };
        });
    }
    catch (err) {
        console.error("Error reading employees:", err);
        return [];
    }
}
