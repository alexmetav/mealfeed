import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, ".env");
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error("Error loading .env file:", result.error);
} else {
  console.log(".env file loaded successfully");
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not defined in environment!");
  process.exit(1);
}

console.log(`Testing connection to: ${connectionString.replace(/:([^:@]+)@/, ":****@")}`);

const client = new pg.Client({ 
  user: 'postgres.isontzkqfyvhimqsahrt',
  password: 'Agra@26081997',
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: { 
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 15000,
});

async function test() {
  console.log("Testing connection to Supabase...");
  try {
    await client.connect();
    console.log("Successfully connected to Supabase!");
    const res = await client.query("SELECT NOW()");
    console.log("Current time from DB:", res.rows[0].now);
    await client.end();
  } catch (err: any) {
    console.error("Connection failed:", err.message);
    if (err.code === 'ECONNREFUSED') {
      console.warn("Connection refused. This is likely an IPv6/IPv4 issue or the database is down.");
    }
  }
}

test();
