
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

async function run() {
  try {
    const hasAttachments = await db.schema.hasColumn("events", "attachments");
    if (hasAttachments) {
      console.log("Checking attachments column type...");
      // In MySQL, we can check the column type using raw query
      const result = await db.raw("SHOW COLUMNS FROM events LIKE 'attachments'");
      const columnType = result[0][0].Type;
      console.log("Current attachments column type:", columnType);
      
      if (columnType.toLowerCase().includes("varchar")) {
        console.log("Changing attachments column to TEXT...");
        await db.schema.alterTable("events", (t) => {
          t.text("attachments").alter();
        });
        console.log("Column altered successfully.");
      } else {
        console.log("Column is already TEXT or suitable type.");
      }
    } else {
      console.log("Adding attachments column to events as TEXT...");
      await db.schema.table("events", (t) => {
        t.text("attachments");
      });
      console.log("Column added successfully.");
    }

    // Also check events_archive
    const hasAttachmentsArchive = await db.schema.hasColumn("events_archive", "attachments");
    if (hasAttachmentsArchive) {
        const result = await db.raw("SHOW COLUMNS FROM events_archive LIKE 'attachments'");
        const columnType = result[0][0].Type;
        if (columnType.toLowerCase().includes("varchar")) {
            console.log("Changing events_archive.attachments column to TEXT...");
            await db.schema.alterTable("events_archive", (t) => {
                t.text("attachments").alter();
            });
        }
    } else {
        console.log("Adding attachments column to events_archive as TEXT...");
        await db.schema.table("events_archive", (t) => {
            t.text("attachments");
        });
    }

    console.log("Schema update complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating schema:", err);
    process.exit(1);
  }
}

run();
