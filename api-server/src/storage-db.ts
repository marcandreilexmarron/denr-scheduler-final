import knex from "knex";
import type { Knex } from "knex";

let _knex: Knex | null = null;

function getKnex(): Knex {
  if (_knex) return _knex;
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

function parseJson<T>(v: any, fallback: T): T {
  try {
    if (v == null) return fallback;
    if (typeof v !== "string") return v as T;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function toDbJson(v: any) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// Helpers for event mapping
function mapEventFromDb(r: any) {
  const {
    date_type,
    start_date,
    end_date,
    start_time,
    end_time,
    participant_tokens,
    created_by,
    created_by_office,
    created_at,
    category_detail,
    type,
    reminder_sent,
    ...rest
  } = r;
  return {
    ...rest,
    dateType: date_type,
    startDate: start_date,
    endDate: end_date,
    startTime: start_time,
    endTime: end_time,
    participantTokens: parseJson<string[]>(participant_tokens, []),
    participants: parseJson<string[]>(r.participants, []),
    attachments: parseJson<any[]>(r.attachments, []),
    createdBy: created_by,
    createdByOffice: created_by_office,
    createdAt: created_at,
    categoryDetail: category_detail,
    type: type,
    reminderSent: !!reminder_sent
  };
}

function mapEventToDb(e: any) {
  const {
    dateType,
    startDate,
    endDate,
    startTime,
    endTime,
    participantTokens,
    participants,
    attachments,
    createdBy,
    createdByOffice,
    createdAt,
    categoryDetail,
    type,
    reminderSent,
    // Extract unknown properties to prevent inserting them into the DB
    _participantInput,
    ...rest
  } = e;

  // Basic sanitization
  const safeDate = (d: any) => (d === "" ? null : d);
  
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

export async function readEvents(): Promise<any[]> {
  const k = getKnex();
  try {
    const rows = await k("events").select("*");
    return rows.map(mapEventFromDb);
  } catch (err) {
    console.error("Error reading events:", err);
    return [];
  }
}

export async function writeEvents(events: any[]) {
  const k = getKnex();
  try {
    await k.transaction(async (trx) => {
      // Warning: This full-replace strategy is dangerous for concurrency.
      // Ideally, we should switch to insert-on-conflict or per-event upsert.
      await trx("events").del();
      if (events.length > 0) {
        const rows = events.map(mapEventToDb);
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          await trx("events").insert(rows.slice(i, i + chunkSize));
        }
      }
    });
  } catch (err) {
    console.error("Error writing events:", err);
    throw err; // Propagate error so the API can return 500
  }
}

export async function readArchivedEvents(): Promise<any[]> {
  const k = getKnex();
  try {
    const rows = await k("events_archive").select("*");
    return rows.map(mapEventFromDb);
  } catch (err) {
    console.error("Error reading archived events:", err);
    return [];
  }
}

export async function writeArchivedEvents(events: any[]) {
  const k = getKnex();
  await k.transaction(async (trx) => {
    await trx("events_archive").del();
    if (events.length > 0) {
      const rows = events.map(mapEventToDb);
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await trx("events_archive").insert(rows.slice(i, i + chunkSize));
      }
    }
  });
}

export async function readUsers(): Promise<any[]> {
  const k = getKnex();
  try {
    const rows = await k("office_users").select("*");
    return rows.map((r: any) => {
      const { office_name, ...rest } = r;
      return { ...rest, officeName: office_name };
    });
  } catch (err) {
    console.error("Error reading users:", err);
    return [];
  }
}

export async function writeUsers(users: any[]) {
  const k = getKnex();
  await k.transaction(async (trx) => {
    await trx("office_users").del();
    if (users.length > 0) {
      const rows = users.map((u: any) => {
        const { officeName, ...rest } = u;
        return { ...rest, office_name: officeName };
      });
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await trx("office_users").insert(rows.slice(i, i + chunkSize));
      }
    }
  });
}

export async function readHolidays(): Promise<Array<{ month: number; day: number; name?: string }>> {
  const k = getKnex();
  try {
    const rows = await k("holidays").select(["month", "day", "name"]);
    return rows;
  } catch (err) {
    console.error("Error reading holidays:", err);
    return [];
  }
}

export async function writeHolidays(holidays: Array<{ month: number; day: number; name?: string }>): Promise<void> {
  const k = getKnex();
  try {
    await k.transaction(async (trx) => {
      await trx("holidays").del();
      if (holidays.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < holidays.length; i += chunkSize) {
          await trx("holidays").insert(holidays.slice(i, i + chunkSize));
        }
      }
    });
  } catch (err) {
    console.error("Error writing holidays:", err);
  }
}

export async function readEmployees(): Promise<any[]> {
  const k = getKnex();
  try {
    // Map employee_details columns to expected structure
    // Expected: { name, officeName, ... }
    const rows = await k("employee_details").select("*");
    return rows.map((r: any) => {
      const { division, ...rest } = r;
      // Map 'division' from DB to 'officeName' for the app
      return { ...rest, officeName: division };
    });
  } catch (err) {
    console.error("Error reading employees:", err);
    return [];
  }
}
