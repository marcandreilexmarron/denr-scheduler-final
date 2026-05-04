
import knex from "knex";
import "dotenv/config";

const client = (process.env.DATABASE_CLIENT || "").trim();
const connection = (process.env.DATABASE_URL || "").trim();

if (!client || !connection) {
  console.error("DATABASE_CLIENT and DATABASE_URL must be set");
  process.exit(1);
}

const db = knex({
  client,
  connection
});

const TABLE_PREFIX = (process.env.DB_TABLE_PREFIX || "scheduler_").trim();
function tableName(base: string) {
  if (!TABLE_PREFIX) return base;
  return base.startsWith(TABLE_PREFIX) ? base : `${TABLE_PREFIX}${base}`;
}

async function run() {
  try {
    // 1. Add email to office_users
    const hasEmail = await db.schema.hasColumn(tableName("office_users"), "email");
    if (!hasEmail) {
      console.log("Adding email column to office_users...");
      await db.schema.table(tableName("office_users"), (t) => {
        t.string("email");
      });
    } else {
      console.log("office_users already has email column.");
    }

    // 2. Add reminder_sent to events
    const hasReminderSent = await db.schema.hasColumn(tableName("events"), "reminder_sent");
    if (!hasReminderSent) {
      console.log("Adding reminder_sent column to events...");
      await db.schema.table(tableName("events"), (t) => {
        t.boolean("reminder_sent").defaultTo(false);
      });
    } else {
      console.log("events already has reminder_sent column.");
    }

    console.log("Schema update complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating schema:", err);
    process.exit(1);
  }
}

run();
