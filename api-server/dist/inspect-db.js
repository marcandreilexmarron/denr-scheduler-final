import knex from "knex";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
const client = (process.env.DATABASE_CLIENT || "").trim();
const connection = (process.env.DATABASE_URL || "").trim();
console.log("Connecting to:", connection);
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
        const userTable = tableName("office_users");
        const exists = await db.schema.hasTable(userTable);
        if (!exists) {
            console.log(`Table '${userTable}' does not exist.`);
            const tables = await db.raw("SHOW TABLES");
            console.log("Available tables:", tables[0]);
        }
        else {
            console.log(`Table '${userTable}' exists.`);
            const columns = await db(userTable).columnInfo();
            console.log("Columns:", columns);
            const firstRow = await db(userTable).first();
            console.log("First row sample:", firstRow);
        }
    }
    catch (err) {
        console.error("Error:", err);
    }
    finally {
        await db.destroy();
    }
}
inspect();
