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
async function inspect() {
    try {
        const exists = await db.schema.hasTable("office_users");
        if (!exists) {
            console.log("Table 'office_users' does not exist.");
            const tables = await db.raw("SHOW TABLES");
            console.log("Available tables:", tables[0]);
        }
        else {
            console.log("Table 'office_users' exists.");
            const columns = await db("office_users").columnInfo();
            console.log("Columns:", columns);
            const firstRow = await db("office_users").first();
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
