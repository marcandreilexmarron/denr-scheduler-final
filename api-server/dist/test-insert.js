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
async function testEventInsert() {
    try {
        const id = "test-" + Date.now();
        const payload = {
            id,
            title: "Test Event",
            category: "meeting",
            date_type: "single",
            date: new Date(),
            created_at: new Date()
        };
        console.log("Attempting to insert:", payload);
        await db("events").insert(payload);
        console.log("Insert success!");
        await db("events").where({ id }).del();
        console.log("Cleanup success!");
    }
    catch (err) {
        console.error("Insert failed:", err);
    }
    finally {
        await db.destroy();
    }
}
testEventInsert();
