import { db } from './src/firebase';
import { collection, getDocs } from 'firebase/firestore';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

/**
 * Migration script to copy posts from Firestore to PostgreSQL.
 * Run this once to migrate existing data.
 */
async function migratePosts() {
  const connectionString = process.env.DATABASE_URL;
  const sslConfig = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false };

  const client = new Client({
    connectionString,
    ssl: sslConfig,
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL for migration.");

    // 1. Get all posts from Firestore
    console.log("Fetching posts from Firestore...");
    const snapshot = await getDocs(collection(db, 'posts'));
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Found ${posts.length} posts in Firestore.`);

    // 2. Save each post into PostgreSQL
    for (const post of posts as any[]) {
      console.log(`Migrating post: ${post.id}`);
      await client.query(
        "INSERT INTO posts (user_id, content, image_url, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [post.userId, post.content, post.imageUrl, post.createdAt?.toDate() || new Date()]
      );
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

migratePosts();
