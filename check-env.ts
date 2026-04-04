import dotenv from "dotenv";
dotenv.config();
if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL is set in environment");
  const url = process.env.DATABASE_URL;
  console.log("Protocol:", url.split(":")[0]);
  console.log("Host:", url.split("@")[1]?.split(":")[0] || "unknown");
} else {
  console.log("DATABASE_URL is NOT set in environment");
}
