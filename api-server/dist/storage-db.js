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
export async function readEvents() {
    const k = getKnex();
    try {
        const rows = await k("events").select("*");
        return rows.map((r) => ({
            ...r,
            participants: parseJson(r.participants, []),
            participantTokens: parseJson(r.participantTokens, []),
            attachments: parseJson(r.attachments, [])
        }));
    }
    catch {
        return [];
    }
}
export async function writeEvents(events) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx("events").del();
        if (events.length > 0) {
            const rows = events.map((e) => ({
                ...e,
                participants: toDbJson(e.participants),
                participantTokens: toDbJson(e.participantTokens),
                attachments: toDbJson(e.attachments)
            }));
            // Insert in chunks to avoid parameter limits
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                await trx("events").insert(rows.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readArchivedEvents() {
    const k = getKnex();
    try {
        const rows = await k("events_archive").select("*");
        return rows.map((r) => ({
            ...r,
            participants: parseJson(r.participants, []),
            participantTokens: parseJson(r.participantTokens, []),
            attachments: parseJson(r.attachments, [])
        }));
    }
    catch {
        return [];
    }
}
export async function writeArchivedEvents(events) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx("events_archive").del();
        if (events.length > 0) {
            const rows = events.map((e) => ({
                ...e,
                participants: toDbJson(e.participants),
                participantTokens: toDbJson(e.participantTokens),
                attachments: toDbJson(e.attachments)
            }));
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                await trx("events_archive").insert(rows.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readUsers() {
    const k = getKnex();
    try {
        return await k("users").select("*");
    }
    catch {
        return [];
    }
}
export async function writeUsers(users) {
    const k = getKnex();
    await k.transaction(async (trx) => {
        await trx("users").del();
        if (users.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < users.length; i += chunkSize) {
                await trx("users").insert(users.slice(i, i + chunkSize));
            }
        }
    });
}
export async function readHolidays() {
    const k = getKnex();
    try {
        const rows = await k("holidays").select(["month", "day", "name"]);
        return rows;
    }
    catch {
        return [];
    }
}
export async function readEmployees() {
    const k = getKnex();
    try {
        return await k("employees").select("*");
    }
    catch {
        return [];
    }
}
