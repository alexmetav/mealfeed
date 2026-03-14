import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageCircle, Bookmark, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';

interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorImage?: string;
  imageUrl: string;
  foodType: string;
  category: string;
  healthRating: string;
  healthScore: number;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export default function Feed() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(newPosts);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, []);

  const handleLike = async (postId: string, authorId: string) => {
    if (!user || !profile) return;
    
    const likeId = `${user.uid}_${postId}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', postId);
    const userRef = doc(db, 'users', user.uid);
    const authorRef = doc(db, 'users', authorId);
    const today = new Date().toISOString().split('T')[0];

    try {
      if (likedPosts.has(postId)) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        // Check daily limit
        const isNewDay = profile.lastActionDate !== today;
        const currentLikes = isNewDay ? 0 : (profile.dailyLikesCount || 0);
        
        if (currentLikes >= 50) {
          alert('Daily like limit (50) reached!');
          return;
        }

        // Like
        await setDoc(likeRef, {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
        
        // Update points and counts
        await updateDoc(userRef, {
          points: increment(100),
          dailyLikesCount: isNewDay ? 1 : increment(1),
          lastActionDate: today
        });

        // Reward author if it's not the same user
        if (authorId !== user.uid) {
          await updateDoc(authorRef, {
            points: increment(100)
          });
        }

        setLikedPosts(prev => new Set(prev).add(postId));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
    }
  };

  const [commentText, setCommentText] = useState('');
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);

  const handleComment = async (postId: string, authorId: string) => {
    if (!user || !profile || !commentText.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = profile.lastActionDate !== today;
    const currentComments = isNewDay ? 0 : (profile.dailyCommentsCount || 0);

    if (currentComments >= 10) {
      alert('Daily comment limit (10) reached!');
      return;
    }

    const commentId = `${user.uid}_${Date.now()}`;
    const commentRef = doc(db, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);
    const userRef = doc(db, 'users', user.uid);
    const authorRef = doc(db, 'users', authorId);

    try {
      await setDoc(commentRef, {
        postId,
        userId: user.uid,
        authorName: profile.username,
        text: commentText,
        createdAt: new Date().toISOString()
      });

      await updateDoc(postRef, { commentsCount: increment(1) });

      // Update points and counts
      await updateDoc(userRef, {
        points: increment(500),
        dailyCommentsCount: isNewDay ? 1 : increment(1),
        lastActionDate: today
      });

      // Reward author if it's not the same user
      if (authorId !== user.uid) {
        await updateDoc(authorRef, {
          points: increment(500)
        });
      }

      setCommentText('');
      setActiveCommentPost(null);
      alert('Comment posted! +500 points');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `comments/${commentId}`);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 font-sans">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Global Feed</h1>
        <div className="flex gap-2 bg-zinc-100 dark:bg-white/5 p-1 rounded-full border border-zinc-200 dark:border-white/10">
          <button className="px-5 py-2 rounded-full bg-zinc-200 dark:bg-white/10 text-sm font-medium text-zinc-900 dark:text-white shadow-sm">Trending</button>
          <button className="px-5 py-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors text-sm font-medium">Recent</button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>No posts yet. Be the first to upload!</p>
        </div>
      ) : (
        posts.map((post) => (
          <article key={post.id} className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/50 transition-transform duration-300 hover:scale-[1.01]">
            {/* Header */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img 
                   src={post.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} 
                  alt={post.authorName} 
                  className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-white tracking-tight">{post.authorName}</span>
                    {/* Premium Badge Mock */}
                    {post.healthScore > 80 && (
                      <span className="text-[10px] px-2 py-0.5 bg-orange-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-orange-500/20">Pro</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="relative aspect-square bg-zinc-50 dark:bg-black">
              <img 
                src={post.imageUrl} 
                alt={post.foodType}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <span className="px-4 py-2 bg-zinc-50 dark:bg-black/40 backdrop-blur-xl rounded-full text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-lg">
                  {post.foodType}
                </span>
                <span className={clsx(
                  "px-4 py-2 backdrop-blur-xl rounded-full text-xs font-bold border shadow-lg text-center",
                  post.healthRating === 'High' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                  post.healthRating === 'Medium' ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                  "bg-red-500/20 text-red-400 border-red-500/30"
                )}>
                  {post.healthRating} Health
                </span>
              </div>
              <div className="absolute bottom-4 left-4">
                <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-lg shadow-emerald-900/40 border border-emerald-400/50">
                  Health Score: {post.healthScore}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-5">
                  <button 
                    onClick={() => handleLike(post.id, post.userId)}
                    className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors group"
                  >
                    <Heart className={clsx("w-7 h-7 transition-transform group-hover:scale-110", likedPosts.has(post.id) && "fill-orange-500 text-orange-500")} />
                  </button>
                  <button 
                    onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group"
                  >
                    <MessageCircle className="w-7 h-7 transition-transform group-hover:scale-110" />
                  </button>
                </div>
                <button className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group">
                  <Bookmark className="w-7 h-7 transition-transform group-hover:scale-110" />
                </button>
              </div>

              {activeCommentPost === post.id && (
                <div className="mb-4 flex gap-2">
                  <input 
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button 
                    onClick={() => handleComment(post.id, post.userId)}
                    className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl hover:bg-orange-500 transition-colors"
                  >
                    Post
                  </button>
                </div>
              )}

              <div className="font-semibold text-sm mb-2 text-zinc-900 dark:text-white">{post.likesCount} likes</div>
              
              <div className="text-sm leading-relaxed">
                <span className="font-semibold mr-2 text-zinc-900 dark:text-white">{post.authorName}</span>
                <span className="text-zinc-600 dark:text-zinc-300">{post.caption}</span>
              </div>
              
              {post.commentsCount > 0 && (
                <button className="text-zinc-500 text-sm mt-3 hover:text-zinc-500 dark:text-zinc-400 font-medium transition-colors">
                  View all {post.commentsCount} comments
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
