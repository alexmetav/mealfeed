import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Initialize PostgreSQL Pool lazily
let pool: any = null;

// Helper to check if DB is configured
const isDbConfigured = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  const trimmed = url.trim();
  
  // Check for common placeholders
  if (
    trimmed === "" || 
    trimmed === "postgres://user:password@host:port/dbname" ||
    trimmed.includes("@host:port") || 
    trimmed.includes("user:password")
  ) return false;

  // Basic protocol check
  if (!trimmed.startsWith("postgres://") && !trimmed.startsWith("postgresql://")) return false;

  // In this environment (Cloud Run), localhost/127.0.0.1 is almost never correct for a DB
  return !trimmed.includes("localhost") && !trimmed.includes("127.0.0.1");
};

const getPool = () => {
  if (!isDbConfigured()) return null;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    // Most cloud providers (Neon, AWS, etc.) require SSL
    // We'll enable it by default if it's not localhost
    // We use rejectUnauthorized: false to handle self-signed certificates or missing root CAs
    const sslConfig = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false };

    console.log(`[DB] Creating pool with SSL: ${JSON.stringify(sslConfig)}`);

    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      connectionTimeoutMillis: 15000, // Increase to 15 seconds
      idleTimeoutMillis: 30000,
      max: 20,
    });
    
    // Add error handler to the pool to prevent crashes
    pool.on('error', (err: any) => {
      console.error('[DB Pool Error] Unexpected error on idle client:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.warn('[DB Pool Warning] Connection refused. Database might be down or unreachable.');
      }
    });
  }
  return pool;
};

// Test connection on startup
const testDbConnection = async () => {
  if (!isDbConfigured()) {
    console.log("[DB] PostgreSQL not configured, skipping connection test.");
    return;
  }
  
  const url = process.env.DATABASE_URL || "";
  const maskedUrl = url.replace(/:([^:@]+)@/, ":****@");
  console.log(`[DB] Attempting to connect to: ${maskedUrl}`);
  
  const db = getPool();
  if (!db) return;

  try {
    const client = await db.connect();
    console.log("[DB] Successfully connected to PostgreSQL.");
    client.release();
  } catch (err: any) {
    console.error("[DB] Failed to connect to PostgreSQL on startup:", err.message);
    if (err.message.includes("ECONNREFUSED")) {
      console.warn("[DB] Connection refused. Please check if your database server is running and accessible.");
    }
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware for debugging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: isDbConfigured() });
  });

  // Sync User Profile (Full)
  app.post("/api/sync-user", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { 
      uid, email, username, displayName, profileImage, 
      subscriptionPlan, healthScore, role, gender, bio, 
      createdAt, points, streak, dailyLikesCount, 
      dailyCommentsCount, dailyPostsCount, referralsCount,
      followersCount, followingCount, postsCount, isCreator
    } = req.body;

    try {
      const queryText = `
        INSERT INTO users (
          id, email, username, display_name, profile_image, 
          subscription_plan, health_score, role, gender, bio, 
          created_at, points, streak, daily_likes_count, 
          daily_comments_count, daily_posts_count, referrals_count,
          followers_count, following_count, posts_count, is_creator
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          profile_image = EXCLUDED.profile_image,
          subscription_plan = EXCLUDED.subscription_plan,
          health_score = EXCLUDED.health_score,
          role = EXCLUDED.role,
          gender = EXCLUDED.gender,
          bio = EXCLUDED.bio,
          points = EXCLUDED.points,
          streak = EXCLUDED.streak,
          daily_likes_count = EXCLUDED.daily_likes_count,
          daily_comments_count = EXCLUDED.daily_comments_count,
          daily_posts_count = EXCLUDED.daily_posts_count,
          referrals_count = EXCLUDED.referrals_count,
          followers_count = EXCLUDED.followers_count,
          following_count = EXCLUDED.following_count,
          posts_count = EXCLUDED.posts_count,
          is_creator = EXCLUDED.is_creator
        RETURNING *
      `;
      const values = [
        uid, email, username, displayName, profileImage,
        subscriptionPlan || 'free', healthScore || 100, role || 'user', gender || 'other', bio || '',
        createdAt || new Date().toISOString(), points || 0, streak || 0, dailyLikesCount || 0,
        dailyCommentsCount || 0, dailyPostsCount || 0, referralsCount || 0,
        followersCount || 0, followingCount || 0, postsCount || 0, isCreator || false
      ];
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      const result = await db.query(queryText, values);
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error syncing user:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to sync user" });
    }
  });

  // Get User Profile (Full)
  app.get("/api/users/:id", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { id } = req.params;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const u = result.rows[0];
      // Map DB fields back to camelCase for frontend
      const profile = {
        uid: u.id,
        email: u.email,
        username: u.username,
        displayName: u.display_name,
        profileImage: u.profile_image,
        subscriptionPlan: u.subscription_plan,
        healthScore: u.health_score,
        role: u.role,
        gender: u.gender,
        bio: u.bio,
        createdAt: u.created_at,
        points: u.points,
        streak: u.streak,
        dailyLikesCount: u.daily_likes_count,
        dailyCommentsCount: u.daily_comments_count,
        dailyPostsCount: u.daily_posts_count,
        referralsCount: u.referrals_count,
        followersCount: u.followers_count,
        followingCount: u.following_count,
        postsCount: u.posts_count,
        isCreator: u.is_creator
      };
      
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching user:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to fetch user" });
    }
  });

  // Create Post
  app.post("/api/posts", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { userId, content, imageUrl, foodType, category, healthRating, healthScore, calories, protein, carbs, fat } = req.body;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      const result = await db.query(
        "INSERT INTO posts (user_id, content, image_url, food_type, category, health_rating, health_score, calories, protein, carbs, fat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
        [userId, content, imageUrl, foodType, category, healthRating, healthScore, calories, protein, carbs, fat]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error creating post:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to create post" });
    }
  });

  // Get Feed (Timeline)
  app.get("/api/feed", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { userId, type = 'recent', limit = 50, offset = 0 } = req.query;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      let queryText = `
        SELECT p.*, u.display_name, u.profile_image as author_image,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
      `;

      const params: any[] = [limit, offset];
      let paramIndex = 3;

      if (userId) {
        queryText += ` WHERE p.user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (type === 'trending') {
        queryText += ` ORDER BY likes_count DESC, p.created_at DESC`;
      } else {
        queryText += ` ORDER BY p.created_at DESC`;
      }

      queryText += ` LIMIT $1 OFFSET $2`;
      
      const result = await db.query(queryText, params);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching feed:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to fetch feed" });
    }
  });

  // Like Post
  app.post("/api/posts/:id/like", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { userId } = req.body;
    const postId = req.params.id;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      await db.query(
        "INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, postId]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error liking post:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to like post" });
    }
  });

  // Follow User
  app.post("/api/follows", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { followerId, followingId } = req.body;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      await db.query(
        "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [followerId, followingId]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error following user:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to follow user" });
    }
  });

  // Get Notifications
  app.get("/api/notifications", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { userId, limit = 20, offset = 0 } = req.query;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      const result = await db.query(`
        SELECT n.*, u.display_name as actor_name, u.profile_image as actor_image
        FROM notifications n
        JOIN users u ON n.actor_id = u.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching notifications:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to fetch notifications" });
    }
  });

  // Mark Notifications as Read
  app.post("/api/notifications/read", async (req, res) => {
    if (!isDbConfigured()) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const { userId, notificationIds } = req.body;
    try {
      const db = getPool();
      if (!db) throw new Error("Database not configured");
      if (notificationIds) {
        await db.query(
          "UPDATE notifications SET read = TRUE WHERE user_id = $1 AND id = ANY($2)",
          [userId, notificationIds]
        );
      } else {
        await db.query(
          "UPDATE notifications SET read = TRUE WHERE user_id = $1",
          [userId]
        );
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notifications as read:", error.message);
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      res.status(statusCode).json({ error: error.code === 'ECONNREFUSED' ? "Database connection refused" : "Failed to mark notifications as read" });
    }
  });

  // Catch-all for API routes that don't match
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] No route matched: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API route not found", 
      method: req.method, 
      path: req.url 
    });
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await testDbConnection();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
