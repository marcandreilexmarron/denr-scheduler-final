import knex from "knex";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
const client = (process.env.DATABASE_CLIENT || "").trim();
const connection = (process.env.DATABASE_URL || "").trim();
const db = knex({
    client,
    connection,
    pool: { min: 0, max: 1 }
});
const TABLE_PREFIX = (process.env.DB_TABLE_PREFIX || "scheduler_").trim();
function tableName(base) {
    if (!TABLE_PREFIX)
        return base;
    return base.startsWith(TABLE_PREFIX) ? base : `${TABLE_PREFIX}${base}`;
}
async function inspect() {
    try {
        const tables = ["events", "events_archive", "employee_details", "holidays", "office_users"];
        for (const base of tables) {
            const t = tableName(base);
            console.log(`\n--- ${t} ---`);
            if (await db.schema.hasTable(t)) {
                const cols = await db(t).columnInfo();
                console.log("Columns:", Object.keys(cols).join(", "));
                const row = await db(t).first();
                console.log("Sample:", row);
            }
            else {
                console.log("DOES NOT EXIST");
            }
        }
    }
    catch (err) {
        console.error(err);
    }
    finally {
        await db.destroy();
    }
}
inspect();
