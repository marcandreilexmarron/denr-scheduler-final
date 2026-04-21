
import knex from 'knex';
import 'dotenv/config';

const db = knex({
  client: process.env.DATABASE_CLIENT,
  connection: process.env.DATABASE_URL,
});

async function check() {
  try {
    const events = await db('events').select('*');
    console.log(`Found ${events.length} events in the database.`);
    if (events.length > 0) {
      console.log('Sample event:', events[0]);
    }
    process.exit(0);
  } catch (err) {
    console.error('Database query failed:', err);
    process.exit(1);
  }
}

check();
