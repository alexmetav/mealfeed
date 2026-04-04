import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ override: true });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
console.log("Using connection string:", connectionString ? connectionString.replace(/:[^:@]+@/, ":****@") : "undefined");
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log("Starting schema migration...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS username TEXT,
      ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_likes_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_comments_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_posts_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS referrals_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS posts_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE;
    `);

    await client.query("COMMIT");
    console.log("Schema migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.log("Schema migration failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
