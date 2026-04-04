import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, increment, setDoc, deleteDoc, where, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageCircle, Bookmark, MapPin, MoreVertical, Trash2, Edit2, RefreshCw, ArrowUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import CommentsModal from '../components/CommentsModal';
import PostCard from '../components/PostCard';
import ConfirmModal from '../components/ConfirmModal';
import { aiVision } from '../services/aiService';
import { postgresService } from '../services/postgresService';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'trending' | 'recent'>('trending');
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [rescanPost, setRescanPost] = useState<Post | null>(null);
  const [quota, setQuota] = useState(100); // Simulate 100 read/write units
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const [showNewPostNotification, setShowNewPostNotification] = useState(false);

  // Simulate high traffic by adding new posts periodically
  useEffect(() => {
    if (activeTab !== 'recent' || isSavedPage) return;

    const interval = setInterval(() => {
      setPosts(prev => {
        if (prev.length === 0) return prev;
        // Shuffle existing posts to simulate new activity
        const shuffled = [...prev].sort(() => Math.random() - 0.5);
        
        // Show notification that someone posted fresh
        if (Math.random() > 0.5) {
          setShowNewPostNotification(true);
          setTimeout(() => setShowNewPostNotification(false), 4000);
        }
        
        return shuffled;
      });
    }, 5000); // Shuffle every 5 seconds to simulate "new" activity

    return () => clearInterval(interval);
  }, [activeTab, isSavedPage]);

  // Quota simulation logic
  const consumeQuota = (amount: number) => {
    setQuota(prev => {
      const next = prev - amount;
      if (next <= 0) {
        setIsQuotaLoading(true);
        setTimeout(() => {
          setQuota(100);
          setIsQuotaLoading(false);
        }, 2000); // Reset after 2 seconds
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'follows'), where('followerId', '==', user.uid), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setFollowing(new Set(snap.docs.map(d => d.data().followingId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'likes'), where('userId', '==', user.uid), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setLikedPosts(new Set(snap.docs.map(d => d.data().postId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'saved_posts'), where('userId', '==', user.uid), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setSavedPosts(new Set(snap.docs.map(d => d.data().postId)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const fetchPosts = async (isInitial = true) => {
      if (isInitial) {
        setLoading(true);
        setPosts([]);
        setLastVisible(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      consumeQuota(10); // Consume quota for fetching

      try {
        if (isSavedPage) {
          // ... (keep saved posts logic for now as it's more complex to move)
          if (savedPosts.size === 0) {
            setPosts([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
          
          const savedPostIds = Array.from(savedPosts);
          const chunks = [];
          for (let i = 0; i < savedPostIds.length; i += 10) {
            chunks.push(savedPostIds.slice(i, i + 10));
          }

          const { documentId } = await import('firebase/firestore');
          const results = await Promise.all(chunks.map(chunk => 
            getDocs(query(collection(db, 'posts'), where(documentId(), 'in', chunk)))
          ));

          const allSavedPosts = results.flatMap(snap => 
            snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post))
          );
          
          setPosts(allSavedPosts.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
          setHasMore(false);
        } else {
          // FETCH FROM POSTGRESQL
          const offset = isInitial ? 0 : posts.length;
          const pgPosts = await postgresService.getFeed(activeTab, 10, offset);
          
          if (pgPosts.length === 0) {
            setHasMore(false);
          } else {
            const formattedPosts = pgPosts.map(p => ({
              id: p.id.toString(),
              userId: p.user_id,
              authorName: p.display_name,
              authorImage: p.author_image,
              imageUrl: p.image_url || '',
              foodType: p.food_type || '',
              category: p.category || '',
              healthRating: p.health_rating || 'Medium',
              healthScore: p.health_score || 0,
              calories: p.calories,
              protein: p.protein,
              carbs: p.carbs,
              fat: p.fat,
              caption: p.content,
              likesCount: p.likes_count,
              commentsCount: p.comments_count,
              createdAt: p.created_at
            } as Post));

            setPosts(prev => isInitial ? formattedPosts : [...prev, ...formattedPosts]);
            setHasMore(pgPosts.length === 10);
          }
        }
      } catch (error) {
        console.error("Error fetching from Postgres, falling back to Firestore:", error);
        // Fallback to Firestore if Postgres fails (e.g. not configured)
        try {
          let q;
          const postsLimit = 10;
          
          if (activeTab === 'trending') {
            q = query(
              collection(db, 'posts'), 
              orderBy('likesCount', 'desc'), 
              orderBy('createdAt', 'desc'),
              limit(postsLimit)
            );
          } else {
            q = query(
              collection(db, 'posts'), 
              orderBy('createdAt', 'desc'), 
              limit(postsLimit)
            );
          }

          if (!isInitial && lastVisible) {
            q = query(q, startAfter(lastVisible));
          }

          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            setHasMore(false);
          } else {
            const newPosts = snapshot.docs.map(doc => {
              const data = doc.data() as any;
              return { id: doc.id, ...data } as Post;
            });
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setPosts(prev => isInitial ? newPosts : [...prev, ...newPosts]);
            setHasMore(snapshot.docs.length === postsLimit);
          }
        } catch (fsError) {
          handleFirestoreError(fsError, OperationType.LIST, 'posts');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchPosts();
  }, [activeTab, isSavedPage, savedPosts]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || isQuotaLoading) return;
    
    setLoadingMore(true);
    consumeQuota(5); // Consume quota for loading more
    try {
      if (isSavedPage) {
        // Saved posts pagination is not yet implemented for Postgres
        setHasMore(false);
        return;
      }

      // FETCH FROM POSTGRESQL
      const offset = posts.length;
      const pgPosts = await postgresService.getFeed(activeTab, 10, offset);
      
      if (pgPosts.length === 0) {
        setHasMore(false);
      } else {
        const formattedPosts = pgPosts.map(p => ({
          id: p.id.toString(),
          userId: p.user_id,
          authorName: p.display_name,
          authorImage: p.author_image,
          imageUrl: p.image_url || '',
          foodType: p.food_type || '',
          category: p.category || '',
          healthRating: p.health_rating || 'Medium',
          healthScore: p.health_score || 0,
          calories: p.calories,
          protein: p.protein,
          carbs: p.carbs,
          fat: p.fat,
          caption: p.content,
          likesCount: p.likes_count,
          commentsCount: p.comments_count,
          createdAt: p.created_at
        } as Post));

        setPosts(prev => [...prev, ...formattedPosts]);
        setHasMore(pgPosts.length === 10);
      }
    } catch (error) {
      console.error("Error fetching more from Postgres, falling back to Firestore:", error);
      // Fallback to Firestore
      try {
        if (!lastVisible) {
          setHasMore(false);
          return;
        }
        let q;
        const postsLimit = 10;
        
        if (activeTab === 'trending') {
          q = query(
            collection(db, 'posts'), 
            orderBy('likesCount', 'desc'), 
            orderBy('createdAt', 'desc'),
            startAfter(lastVisible),
            limit(postsLimit)
          );
        } else {
          q = query(
            collection(db, 'posts'), 
            orderBy('createdAt', 'desc'), 
            startAfter(lastVisible),
            limit(postsLimit)
          );
        }

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setHasMore(false);
        } else {
          const newPosts = snapshot.docs.map(doc => {
            const data = doc.data() as any;
            return { id: doc.id, ...data } as Post;
          });
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setPosts(prev => [...prev, ...newPosts]);
          setHasMore(snapshot.docs.length === postsLimit);
        }
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.LIST, 'posts');
      }
    } finally {
      setLoadingMore(false);
    }
  };

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
      console.error('Like error:', error);
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

  const handleDeletePost = async () => {
    if (!deletePostId) return;
    try {
      await deleteDoc(doc(db, 'posts', deletePostId));
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          postsCount: increment(-1)
        });
      }
      setDeletePostId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${deletePostId}`);
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

  const handleRescan = async () => {
    if (!rescanPost) return;
    setRescanningId(rescanPost.id);
    const postToRescan = rescanPost;
    setRescanPost(null);
    try {
      const base64Data = postToRescan.imageUrl.split(',')[1] || postToRescan.imageUrl;
      const mimeType = postToRescan.imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      
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
        
        await updateDoc(doc(db, 'posts', postToRescan.id), {
          foodType: parsedResult.foodType,
          category: parsedResult.category,
          healthRating: parsedResult.healthRating,
          healthScore: parsedResult.healthScore,
          calories: parsedResult.calories,
          protein: parsedResult.protein,
          carbs: parsedResult.carbs,
          fat: parsedResult.fat,
        });
        // alert('Post successfully rescanned and updated!');
      }
    } catch (error: any) {
      console.error('Rescan failed:', error);
      // if (error.message?.toLowerCase().includes('insufficient balance') || error.message?.includes('402')) {
      //   alert('AI Quota Exceeded: Insufficient balance in OpenAI account. Please check your billing details.');
      // } else {
      //   alert('Failed to rescan image. Please try again later.');
      // }
    } finally {
      setRescanningId(null);
    }
  };

  const [commentsModalPost, setCommentsModalPost] = useState<{id: string, authorId: string} | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewPostNotification(false);
  };

  // Infinite scroll observer
  useEffect(() => {
    if (loading || !hasMore || loadingMore || isQuotaLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    const target = document.getElementById('infinite-scroll-trigger');
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [loading, hasMore, loadingMore, isQuotaLoading, posts]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 font-sans relative">
      <AnimatePresence>
        {showNewPostNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            onClick={scrollToTop}
            className="fixed top-24 left-1/2 z-[100] cursor-pointer"
          >
            <div className="bg-yellow-500 text-white px-6 py-3 rounded-full shadow-2xl shadow-yellow-500/40 flex items-center gap-3 border border-yellow-400/50 backdrop-blur-md">
              <div className="relative">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">Someone just posted fresh!</span>
              <ArrowUp className="w-4 h-4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <>
          <div className="space-y-8">
            {posts.map((post) => (
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
                onDelete={setDeletePostId}
                onSaveCaption={handleSaveCaption}
                onRescan={setRescanPost}
                onOpenComments={(postId, authorId) => setCommentsModalPost({ id: postId, authorId })}
                rescanningId={rescanningId}
              />
            ))}
            <div id="infinite-scroll-trigger" className="h-10" />
          </div>

          {(loadingMore || isQuotaLoading) && (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
                <p className="text-sm font-medium text-zinc-500 animate-pulse">
                  {isQuotaLoading ? 'Quota limit reached. Loading next set...' : 'Fetching more delicious meals...'}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!deletePostId}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={handleDeletePost}
        onCancel={() => setDeletePostId(null)}
        confirmText="Delete"
      />

      <ConfirmModal
        isOpen={!!rescanPost}
        title="Rescan Image"
        message="Are you sure you want to rescan this image? This will update the nutritional information."
        onConfirm={handleRescan}
        onCancel={() => setRescanPost(null)}
        confirmText="Rescan"
      />

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
