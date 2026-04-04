import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Replace port 5432 with 6543 if it exists
const connectionString = rawUrl.replace(":5432/", ":6543/");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log(`Starting schema migration with URL: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
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
      console.error("Schema migration failed:", error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Connection failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
