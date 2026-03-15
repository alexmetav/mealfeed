import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, increment, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageCircle, Bookmark, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import CommentsModal from '../components/CommentsModal';

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
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorIsCreator?: boolean;
}

export default function Feed() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'trending' | 'recent'>('trending');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setFollowing(new Set(snap.docs.map(d => d.data().followingId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'likes'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setLikedPosts(new Set(snap.docs.map(d => d.data().postId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setLoading(true);
    let q;
    if (activeTab === 'trending') {
      q = query(collection(db, 'posts'), orderBy('likesCount', 'desc'), limit(50));
    } else {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(newPosts);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [activeTab]);

  const handleFollow = async (authorId: string, authorName: string, authorImage?: string) => {
    if (!user || !profile || authorId === user.uid) return;
    const followId = `${user.uid}_${authorId}`;
    const followRef = doc(db, 'follows', followId);
    const authorRef = doc(db, 'users', authorId);
    const userRef = doc(db, 'users', user.uid);

    try {
      if (following.has(authorId)) {
        // Unfollow
        setFollowing(prev => {
          const next = new Set(prev);
          next.delete(authorId);
          return next;
        });
        await deleteDoc(followRef);
        await updateDoc(authorRef, { followersCount: increment(-1) });
        await updateDoc(userRef, { followingCount: increment(-1) });
      } else {
        // Follow
        setFollowing(prev => new Set(prev).add(authorId));
        await setDoc(followRef, { 
          followerId: user.uid, 
          followerName: profile.username,
          followerImage: profile.profileImage || '',
          followingId: authorId, 
          followingName: authorName,
          followingImage: authorImage || '',
          createdAt: new Date().toISOString() 
        });
        await updateDoc(authorRef, { followersCount: increment(1) });
        await updateDoc(userRef, { followingCount: increment(1) });
        
        // Create notification
        const notificationId = `${user.uid}_follow_${authorId}`;
        await setDoc(doc(db, 'notifications', notificationId), {
          userId: authorId,
          actorId: user.uid,
          actorName: profile.username,
          actorImage: profile.profileImage || '',
          type: 'follow',
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      if (following.has(authorId)) {
        setFollowing(prev => new Set(prev).add(authorId));
      } else {
        setFollowing(prev => {
          const next = new Set(prev);
          next.delete(authorId);
          return next;
        });
      }
      handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
    }
  };

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
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        // Check daily limit
        const isNewDay = profile.lastActionDate !== today;
        const currentLikes = isNewDay ? 0 : (profile.dailyLikesCount || 0);
        
        if (currentLikes >= 50) {
          alert('Daily like limit (50) reached!');
          return;
        }

        // Like
        setLikedPosts(prev => new Set(prev).add(postId));
        await setDoc(likeRef, {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
        
        // Update points and counts
        const pointsToEarn = profile.isCreator ? 100 : 50;
        await updateDoc(userRef, {
          points: increment(pointsToEarn),
          dailyLikesCount: isNewDay ? 1 : increment(1),
          lastActionDate: today
        });

        // Reward author if it's not the same user
        if (authorId !== user.uid) {
          // We don't know if author is creator here easily without fetching, so just give them 50
          await updateDoc(authorRef, {
            points: increment(50)
          });
          
          // Create notification
          const notificationId = `${user.uid}_like_${postId}`;
          await setDoc(doc(db, 'notifications', notificationId), {
            userId: authorId,
            actorId: user.uid,
            actorName: profile.username,
            actorImage: profile.profileImage || '',
            type: 'like',
            postId,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      if (likedPosts.has(postId)) {
        setLikedPosts(prev => new Set(prev).add(postId));
      } else {
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
      handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
    }
  };

  const [commentsModalPost, setCommentsModalPost] = useState<{id: string, authorId: string} | null>(null);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 font-sans">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Global Feed</h1>
        <div className="flex gap-2 bg-zinc-100 dark:bg-white/5 p-1 rounded-full border border-zinc-200 dark:border-white/10">
          <button 
            onClick={() => setActiveTab('trending')}
            className={clsx(
              "px-5 py-2 rounded-full text-sm font-medium transition-colors shadow-sm",
              activeTab === 'trending' ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white"
            )}
          >
            Trending
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={clsx(
              "px-5 py-2 rounded-full text-sm font-medium transition-colors shadow-sm",
              activeTab === 'recent' ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white"
            )}
          >
            Recent
          </button>
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
                <Link to={`/dashboard/user/${post.userId}`}>
                  <img 
                     src={post.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} 
                    alt={post.authorName} 
                    className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/dashboard/user/${post.userId}`}>
                      <span className="font-semibold text-zinc-900 dark:text-white tracking-tight cursor-pointer hover:text-yellow-500 transition-colors">{post.authorName}</span>
                    </Link>
                    {post.authorIsCreator && (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-blue-500/20">Creator</span>
                    )}
                    {post.userId !== user?.uid && (
                      <button 
                        onClick={() => handleFollow(post.userId, post.authorName, post.authorImage)}
                        className={clsx("text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors uppercase tracking-wider", following.has(post.userId) ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white" : "bg-yellow-500 text-white")}
                      >
                        {following.has(post.userId) ? 'Following' : 'Follow'}
                      </button>
                    )}
                    {/* Premium Badge Mock */}
                    {post.healthScore > 80 && (
                      <span className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-yellow-500/20">Pro</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="relative aspect-square bg-zinc-50 dark:bg-black group">
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
              <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-lg shadow-emerald-900/40 border border-emerald-400/50 w-fit">
                  Health Score: {post.healthScore}
                </div>
                
                {/* Nutritional Info Overlay */}
                {post.calories !== undefined && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                      <span className="text-zinc-400 mr-1">Cal</span>{post.calories}
                    </div>
                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                      <span className="text-zinc-400 mr-1">Pro</span>{post.protein}g
                    </div>
                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                      <span className="text-zinc-400 mr-1">Carb</span>{post.carbs}g
                    </div>
                    <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                      <span className="text-zinc-400 mr-1">Fat</span>{post.fat}g
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-5">
                  <button 
                    onClick={() => handleLike(post.id, post.userId)}
                    className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-yellow-500 transition-colors group"
                  >
                    <Heart className={clsx("w-7 h-7 transition-transform group-hover:scale-110", likedPosts.has(post.id) && "fill-yellow-500 text-yellow-500")} />
                  </button>
                  <button 
                    onClick={() => setCommentsModalPost({ id: post.id, authorId: post.userId })}
                    className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group"
                  >
                    <MessageCircle className="w-7 h-7 transition-transform group-hover:scale-110" />
                  </button>
                </div>
                <button className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group">
                  <Bookmark className="w-7 h-7 transition-transform group-hover:scale-110" />
                </button>
              </div>

              <div className="font-semibold text-sm mb-2 text-zinc-900 dark:text-white">{post.likesCount} likes</div>
              
              <div className="text-sm leading-relaxed">
                <Link to={`/dashboard/user/${post.userId}`}>
                  <span className="font-semibold mr-2 text-zinc-900 dark:text-white cursor-pointer hover:text-yellow-500 transition-colors">{post.authorName}</span>
                </Link>
                <span className="text-zinc-600 dark:text-zinc-300">{post.caption}</span>
              </div>
              
              {post.commentsCount > 0 && (
                <button 
                  onClick={() => setCommentsModalPost({ id: post.id, authorId: post.userId })}
                  className="text-zinc-500 text-sm mt-3 hover:text-zinc-500 dark:text-zinc-400 font-medium transition-colors"
                >
                  View all {post.commentsCount} comments
                </button>
              )}
            </div>
          </article>
        ))
      )}

      {commentsModalPost && (
        <CommentsModal
          postId={commentsModalPost.id}
          postAuthorId={commentsModalPost.authorId}
          isOpen={!!commentsModalPost}
          onClose={() => setCommentsModalPost(null)}
        />
      )}
    </div>
  );
}
