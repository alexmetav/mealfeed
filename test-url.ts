import pg from "pg";
const { Pool } = pg;
const connectionString = "postgresql://postgres:Agra%4026081997@db.isontzkqfyvhimqsahrt.supabase.co:5432/postgres";
const pool = new Pool({ connectionString });
console.log("Pool created successfully with encoded password");
pool.end();
