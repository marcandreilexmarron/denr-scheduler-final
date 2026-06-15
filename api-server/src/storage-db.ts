import knex from "knex";
import type { Knex } from "knex";

let _knex: Knex | null = null;

function isTruthy(value?: string) {
  return /^(1|true|yes|on|required)$/i.test((value || "").trim());
}

function buildConnectionConfig(client: string, connectionOrConfig: string | Record<string, any>) {
  const useSsl = isTruthy(process.env.DATABASE_SSL) || isTruthy(process.env.DB_SSL);

  const rejectUnauthorized = !/^(0|false|no|off)$/i.test(
    (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED || "true").trim()
  );
  const ssl: Record<string, any> = { rejectUnauthorized };
  const caBase64 = (process.env.DATABASE_CA_CERT_BASE64 || process.env.DB_SSL_CA_BASE64 || "").trim();
  const rawCaCert = (process.env.DB_SSL_CA || "").trim();

  if (caBase64) {
    ssl.ca = Buffer.from(caBase64, "base64").toString("utf-8");
  } else if (rawCaCert) {
    ssl.ca = rawCaCert;
  }

  if (typeof connectionOrConfig === "string") {
    // Handle connection string case (existing behavior for backward compatibility)
    if (!useSsl) {
      return connectionOrConfig;
    }

    if (client === "pg") {
      return {
        connectionString: connectionOrConfig,
        ssl
      };
    }

    const url = new URL(connectionOrConfig);
    const extraOptions: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      // Skip ssl-mode since mysql2 doesn't use it
      if (key !== "ssl-mode") {
        extraOptions[key] = value;
      }
    });

    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      ...extraOptions,
      ssl
    };
  } else {
    // Handle individual config object case
    if (!useSsl) {
      return connectionOrConfig;
    }
    return {
      ...connectionOrConfig,
      ssl
    };
  }
}

function getKnex(): Knex {
  if (_knex) return _knex;
  const client = (process.env.DATABASE_CLIENT || "mysql2").trim();

  // Check if individual DB_* variables are provided (prioritize these first)
  const dbHost = (process.env.DB_HOST || "").trim();
  const dbPort = (process.env.DB_PORT || "").trim();
  const dbUser = (process.env.DB_USER || "").trim();
  const dbPassword = (process.env.DB_PASSWORD || "").trim();
  const dbName = (process.env.DB_NAME || "").trim();

  let connection: string | Record<string, any>;

  if (dbHost && dbUser && dbPassword && dbName) {
    // Use individual variables
    connection = {
      host: dbHost,
      port: dbPort ? Number(dbPort) : 3306,
      user: dbUser,
      password: dbPassword,
      database: dbName
    };
  } else {
    // Fall back to DATABASE_URL (backward compatible)
    const dbUrl = (process.env.DATABASE_URL || "").trim();
    if (!dbUrl) {
      throw new Error("Either DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME must be set for DB backend");
    }
    connection = dbUrl;
  }

  _knex = knex({
    client,
    connection: buildConnectionConfig(client, connection),
    pool: { min: 0, max: 10 }
  });
  return _knex;
}

export async function ping(): Promise<void> {
  const k = getKnex();
  await k.raw("select 1");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function syncByKey(trx: Knex.Transaction, table: string, key: string, rows: any[]) {
  const desiredKeys = rows.map((r) => r?.[key]).filter((v) => v != null).map((v) => String(v));
  const desiredSet = new Set(desiredKeys);

  if (desiredKeys.length === 0) {
    await trx(table).del();
    return;
  }

  const existingRows = await trx(table).select([key]);
  const existingKeys = existingRows.map((r: any) => String(r?.[key]));
  const toDelete = existingKeys.filter((k) => !desiredSet.has(k));
  for (const ids of chunk(toDelete, 500)) {
    await trx(table).whereIn(key, ids).del();
  }

  for (const batch of chunk(rows, 100)) {
    await (trx(table).insert(batch) as any).onConflict(key).merge();
  }
}

export function getDataDir() {
  // Unused for DB backend; return empty string for compatibility
  return "";
}

const TABLE_PREFIX = String(process.env.DB_TABLE_PREFIX ?? "").trim();
function tableName(base: string) {
  if (!TABLE_PREFIX) return base;
  return base.startsWith(TABLE_PREFIX) ? base : `${TABLE_PREFIX}${base}`;
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
  const reminderSentMask = (() => {
    const n = Number(reminder_sent);
    if (Number.isFinite(n)) return n;
    return reminder_sent ? 1 : 0;
  })();
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
    reminderSentMask,
    reminderSent: (reminderSentMask & 1) === 1
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
    reminderSentMask,
    // Extract unknown properties to prevent inserting them into the DB
    referToAttachments,
    _participantInput,
    ...rest
  } = e;

  // Basic sanitization
  const safeDate = (d: any) => (d === "" ? null : d);
  const nextReminderSentMask = (() => {
    const n = Number(reminderSentMask);
    if (Number.isFinite(n)) return n;
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

export async function readEvents(): Promise<any[]> {
  const k = getKnex();
  const rows = await k(tableName("events")).select("*");
  return rows.map(mapEventFromDb);
}

export async function writeEvents(events: any[]) {
  const k = getKnex();
  try {
    await k.transaction(async (trx) => {
      const rows = events.map(mapEventToDb);
      await syncByKey(trx, tableName("events"), "id", rows);
    });
  } catch (err) {
    console.error("Error writing events:", err);
    throw err; // Propagate error so the API can return 500
  }
}

export async function readArchivedEvents(): Promise<any[]> {
  const k = getKnex();
  const rows = await k(tableName("events_archive")).select("*");
  return rows.map(mapEventFromDb);
}

export async function writeArchivedEvents(events: any[]) {
  const k = getKnex();
  try {
    await k.transaction(async (trx) => {
      const rows = events.map(mapEventToDb);
      await syncByKey(trx, tableName("events_archive"), "id", rows);
    });
  } catch (err) {
    console.error("Error writing archived events:", err);
    throw err;
  }
}

export async function readUsers(): Promise<any[]> {
  const k = getKnex();
  const rows = await k(tableName("office_users")).select("*");
  return rows.map((r: any) => {
    const { office_name, disabled, ...rest } = r;
    return { 
      ...rest, 
      officeName: office_name,
      disabled: Boolean(disabled)
    };
  });
}

export async function writeUsers(users: any[]) {
  const k = getKnex();
  try {
    await k.transaction(async (trx) => {
      const rows = users.map((u: any) => {
        const { officeName, disabled, ...rest } = u;
        return { 
          ...rest, 
          office_name: officeName,
          disabled: disabled ? 1 : 0 
        };
      });
      await syncByKey(trx, tableName("office_users"), "username", rows);
    });
  } catch (err) {
    console.error("Error writing users:", err);
    throw err;
  }
}

export async function readHolidays(): Promise<Array<{ month: number; day: number; name?: string }>> {
  const k = getKnex();
  const rows = await k(tableName("holidays")).select(["month", "day", "name"]);
  return rows;
}

export async function writeHolidays(holidays: Array<{ month: number; day: number; name?: string }>): Promise<void> {
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
  } catch (err) {
    console.error("Error writing holidays:", err);
  }
}

export async function readEmployees(): Promise<any[]> {
  const k = getKnex();
  const rows = await k(tableName("employee_details")).select("*");
  return rows.map((r: any) => {
    const { division, ...rest } = r;
    return { ...rest, officeName: division };
  });
}
