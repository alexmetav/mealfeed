/**
 * Service to interact with the PostgreSQL backend.
 * This service handles heavy features like the feed and likes.
 */

export interface Post {
  id: number;
  user_id: string;
  content: string;
  image_url?: string;
  food_type?: string;
  category?: string;
  health_rating?: string;
  health_score?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  created_at: string;
  display_name: string;
  author_image?: string;
  likes_count: number;
  comments_count: number;
}

export interface Notification {
  id: number;
  user_id: string;
  actor_id: string;
  actor_name: string;
  actor_image?: string;
  type: string;
  post_id?: number;
  message?: string;
  read: boolean;
  created_at: string;
}

export const postgresService = {
  /**
   * Syncs a Firebase user to the PostgreSQL database.
   */
  async syncUser(profile: any) {
    try {
      const response = await fetch("/api/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      return await response.json();
    } catch (error) {
      console.error("Error syncing user to Postgres:", error);
      throw error;
    }
  },

  /**
   * Fetches a user profile from PostgreSQL.
   */
  async getUserProfile(id: string) {
    try {
      const response = await fetch(`/api/users/${id}`);
      if (response.status === 503) return null; // DB not configured
      if (response.status === 404) return null; // User not in Postgres yet
      if (!response.ok) {
        console.warn(`Postgres API error (${response.status}): Failed to fetch user profile`);
        return null; // Fallback for other errors (like 500 ECONNREFUSED)
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching user profile from Postgres:", error);
      return null; // Fallback on network error
    }
  },

  /**
   * Creates a new post in the PostgreSQL database.
   */
  async createPost(postData: Partial<Post>) {
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error creating post in Postgres:", error);
      throw error;
    }
  },

  /**
   * Fetches the feed (timeline) from the PostgreSQL database.
   */
  async getFeed(type: 'recent' | 'trending' = 'recent', limit = 50, offset = 0): Promise<Post[]> {
    try {
      const response = await fetch(`/api/feed?type=${type}&limit=${limit}&offset=${offset}`);
      if (response.status === 503) throw new Error("Database not configured");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Postgres API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching feed from Postgres:", error);
      throw error; // Throw to trigger fallback in component
    }
  },

  /**
   * Likes a post in the PostgreSQL database.
   */
  async likePost(userId: string, postId: number) {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error liking post in Postgres:", error);
      throw error;
    }
  },

  /**
   * Follows a user in PostgreSQL.
   */
  async followUser(followerId: string, followingId: string) {
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId, followingId }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error following user in Postgres:", error);
      throw error;
    }
  },

  /**
   * Fetches notifications for a user.
   */
  async getNotifications(userId: string, limit = 20, offset = 0): Promise<Notification[]> {
    try {
      const response = await fetch(`/api/notifications?userId=${userId}&limit=${limit}&offset=${offset}`);
      if (response.status === 503) throw new Error("Database not configured");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Postgres API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching notifications from Postgres:", error);
      throw error; // Throw to trigger fallback in component
    }
  },

  /**
   * Marks notifications as read.
   */
  async markNotificationsAsRead(userId: string, notificationIds?: number[]) {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notificationIds }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error marking notifications as read in Postgres:", error);
      throw error;
    }
  },
};
