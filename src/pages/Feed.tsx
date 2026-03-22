import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, increment, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageCircle, Bookmark, MapPin, MoreVertical, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import CommentsModal from '../components/CommentsModal';
import PostCard from '../components/PostCard';

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

import { usePoints } from '../context/PointsContext';

import { checkAndUpdateDailyLimit } from '../utils/dailyLimits';

import { useLocation } from 'react-router-dom';

export default function Feed() {
  const { user, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const isSavedPage = location.pathname === '/dashboard/saved';
  const { showPoints } = usePoints();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'trending' | 'recent'>('trending');
  const [rescanningId, setRescanningId] = useState<string | null>(null);

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
    if (!user) return;
    const q = query(collection(db, 'saved_posts'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setSavedPosts(new Set(snap.docs.map(d => d.data().postId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setLoading(true);
    let q;
    if (isSavedPage) {
      // We'll fetch all posts and filter in memory for simplicity if there are few saved posts,
      // or we could do a more complex query. For now, let's fetch based on savedPosts set.
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
    } else if (activeTab === 'trending') {
      q = query(collection(db, 'posts'), orderBy('likesCount', 'desc'), limit(50));
    } else {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let newPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      if (isSavedPage) {
        newPosts = newPosts.filter(post => savedPosts.has(post.id));
      }
      
      setPosts(newPosts);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [activeTab, isSavedPage, savedPosts]);

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
        // Like
        setLikedPosts(prev => new Set(prev).add(postId));
        await setDoc(likeRef, {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(postRef, { likesCount: increment(1) });
        
        // Check daily limit and reward points
        const canEarnPoints = await checkAndUpdateDailyLimit(user.uid, profile, 'LIKES');
        
        if (canEarnPoints) {
          const pointsToEarn = profile.isCreator ? 100 : 50;
          showPoints(pointsToEarn, 'Post Liked');
          await updateDoc(doc(db, 'users', user.uid), {
            points: increment(pointsToEarn)
          });
        }

        // Reward author if it's not the same user
        if (authorId !== user.uid) {
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
        
        await refreshProfile();
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

  const handleSave = async (postId: string) => {
    if (!user) return;
    const saveId = `${user.uid}_${postId}`;
    const saveRef = doc(db, 'saved_posts', saveId);

    try {
      if (savedPosts.has(postId)) {
        setSavedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        await deleteDoc(saveRef);
      } else {
        setSavedPosts(prev => new Set(prev).add(postId));
        await setDoc(saveRef, {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `saved_posts/${saveId}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          postsCount: increment(-1)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const handleSaveCaption = async (postId: string, newCaption: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        caption: newCaption
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleRescan = async (post: Post) => {
    if (!window.confirm('Are you sure you want to rescan this image? This will update the nutritional information.')) return;
    setRescanningId(post.id);
    try {
      const base64Data = post.imageUrl.split(',')[1] || post.imageUrl;
      const mimeType = post.imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      
      const prompt = `Analyze this food image. Provide the following information in a JSON format:
      - foodType: Name of the food
      - category: Category like Breakfast, Lunch, Snack, etc.
      - healthRating: Must be exactly 'High', 'Medium', or 'Low'
      - healthScore: Score from 0 to 100
      - healthTips: Short health tip
      - calories: Estimated calories
      - protein: Estimated protein in grams
      - carbs: Estimated carbs in grams
      - fat: Estimated fat in grams
      
      Return ONLY the JSON object.`;

      const response = await aiVision(prompt, base64Data, mimeType);

      if (response) {
        const cleanedText = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(cleanedText);
        
        await updateDoc(doc(db, 'posts', post.id), {
          foodType: parsedResult.foodType,
          category: parsedResult.category,
          healthRating: parsedResult.healthRating,
          healthScore: parsedResult.healthScore,
          calories: parsedResult.calories,
          protein: parsedResult.protein,
          carbs: parsedResult.carbs,
          fat: parsedResult.fat,
        });
        alert('Post successfully rescanned and updated!');
      }
    } catch (error: any) {
      console.error('Rescan failed:', error);
      if (error.message?.toLowerCase().includes('insufficient balance') || error.message?.includes('402')) {
        alert('AI Quota Exceeded: Insufficient balance in OpenAI account. Please check your billing details.');
      } else {
        alert('Failed to rescan image. Please try again later.');
      }
    } finally {
      setRescanningId(null);
    }
  };

  const [commentsModalPost, setCommentsModalPost] = useState<{id: string, authorId: string} | null>(null);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 font-sans">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          {isSavedPage ? 'Saved Posts' : 'Global Feed'}
        </h1>
        {!isSavedPage && (
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
        )}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>{isSavedPage ? 'No saved posts yet.' : 'No posts yet. Be the first to upload!'}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.uid}
            isFollowing={following.has(post.userId)}
            isLiked={likedPosts.has(post.id)}
            isSaved={savedPosts.has(post.id)}
            onFollow={handleFollow}
            onLike={handleLike}
            onSave={handleSave}
            onDelete={handleDeletePost}
            onSaveCaption={handleSaveCaption}
            onRescan={handleRescan}
            onOpenComments={(postId, authorId) => setCommentsModalPost({ id: postId, authorId })}
            rescanningId={rescanningId}
          />
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
