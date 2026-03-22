import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, increment, arrayUnion, deleteDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Settings, Grid, Bookmark, Heart, X, Flame, Trophy, CalendarCheck, MessageCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import PostModal from '../components/PostModal';
import CommentsModal from '../components/CommentsModal';
import { openAIVision } from '../services/openaiService';

import { motion, AnimatePresence } from 'framer-motion';
import { usePoints } from '../context/PointsContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { showPoints } = usePoints();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [recheckingHealth, setRecheckingHealth] = useState(false);
  const [commentsModalPost, setCommentsModalPost] = useState<{id: string, authorId: string} | null>(null);

  const fetchPostsAndFollows = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'posts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch followers
      const followersQ = query(collection(db, 'follows'), where('followingId', '==', user.uid));
      const followersSnap = await getDocs(followersQ);
      setFollowers(followersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch following
      const followingQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
      const followingSnap = await getDocs(followingQ);
      setFollowing(followingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch liked posts
      const likesQ = query(collection(db, 'likes'), where('userId', '==', user.uid));
      const likesSnap = await getDocs(likesQ);
      setLikedPosts(new Set(likesSnap.docs.map(doc => doc.data().postId)));

      // Fetch saved posts
      const savedQ = query(collection(db, 'saved_posts'), where('userId', '==', user.uid));
      const savedSnap = await getDocs(savedQ);
      const savedPostIds = savedSnap.docs.map(doc => doc.data().postId);
      
      if (savedPostIds.length > 0) {
        // Fetch the actual post data for saved posts
        // Note: Firestore 'in' query is limited to 10 items, but for a profile we might want more.
        // For now, let's fetch them individually or in chunks if needed.
        // Simple approach: fetch all posts and filter (not ideal for scale but okay for now)
        const allPostsQ = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const allPostsSnap = await getDocs(allPostsQ);
        const allPosts = allPostsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedPosts(allPosts.filter(p => savedPostIds.includes(p.id)));
      } else {
        setSavedPosts([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'posts/follows/likes/saved');
    } finally {
      setLoading(false);
    }
  };

  const handleRecheckHealthScore = async () => {
    if (!user || recheckingHealth) return;
    setRecheckingHealth(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const userPosts = snapshot.docs.map(doc => doc.data());
      
      let newScore = 100;
      if (userPosts.length > 0) {
        const totalScore = userPosts.reduce((acc, post) => acc + (post.healthScore || 0), 0);
        newScore = Math.round(totalScore / userPosts.length);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        healthScore: newScore
      });
      await refreshProfile();
      alert(`Health score updated! Your live score is now ${newScore}/100 based on your ${userPosts.length} posts.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setRecheckingHealth(false);
    }
  };

  useEffect(() => {
    fetchPostsAndFollows();
  }, [user]);

  const handleLike = async (postId: string, authorId: string) => {
    if (!user || !profile) return;

    const likeId = `${user.uid}_${postId}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', postId);

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

        // Create notification
        if (user.uid !== authorId) {
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

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          postsCount: increment(-1)
        });
      }
      setPosts(posts.filter(p => p.id !== postId));
      setSelectedPost(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const handleSaveCaption = async (postId: string, newCaption: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        caption: newCaption
      });
      setPosts(posts.map(p => p.id === postId ? { ...p, caption: newCaption } : p));
      if (selectedPost?.id === postId) {
        setSelectedPost({ ...selectedPost, caption: newCaption });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleRescan = async (post: any) => {
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

      const response = await openAIVision(prompt, base64Data, mimeType);

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
        fetchPostsAndFollows(); // Refresh to get updated data
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

  const handleCheckIn = async () => {
    if (!user || !profile || checkInLoading) return;
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastCheckInDate = profile.lastCheckIn?.split('T')[0]; // Keep for backward compatibility

    if (lastCheckInDate === today || profile.checkInHistory?.includes(today)) {
      alert('You already checked in today!');
      return;
    }

    setCheckInLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      let newStreak = 1;
      if (lastCheckInDate === yesterdayStr || profile.checkInHistory?.includes(yesterdayStr)) {
        newStreak = (profile.streak || 0) + 1;
      }

      const pointsToEarn = profile.isCreator ? 2000 : 1000;
      showPoints(pointsToEarn, 'Daily Check-in');
      await updateDoc(userRef, {
        points: increment(pointsToEarn), // Bonus for daily check-in
        streak: newStreak,
        lastCheckIn: new Date().toISOString(),
        checkInHistory: arrayUnion(today)
      });

      await refreshProfile();
      alert(`Daily check-in successful! +1000 points. Current streak: ${newStreak} days!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setCheckInLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-10 mb-16">
        <div className="relative">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-yellow-500/30 to-purple-500/30">
            <img 
              src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
              alt={profile.username}
              className="w-full h-full rounded-full border-4 border-white dark:border-black object-cover bg-zinc-100 dark:bg-[#1c1c1e]"
            />
          </div>
          {profile.subscriptionPlan !== 'free' && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg shadow-yellow-500/20 border border-yellow-400/50">
              {profile.subscriptionPlan}
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-5 mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
              {profile.username}
              {profile.isCreator && (
                <span className="text-xs px-3 py-1 bg-blue-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-blue-500/20">Creator</span>
              )}
            </h1>
            <div className="flex items-center justify-center gap-3">
              <button 
                onClick={handleCheckIn}
                disabled={checkInLoading || profile.checkInHistory?.includes(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`) || profile.lastCheckIn?.split('T')[0] === new Date().toISOString().split('T')[0]}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 shadow-lg",
                  (profile.checkInHistory?.includes(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`) || profile.lastCheckIn?.split('T')[0] === new Date().toISOString().split('T')[0])
                    ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 cursor-default"
                    : "bg-yellow-600 text-white hover:bg-yellow-500 shadow-yellow-900/20"
                )}
              >
                <CalendarCheck className="w-4 h-4" />
                {(profile.checkInHistory?.includes(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`) || profile.lastCheckIn?.split('T')[0] === new Date().toISOString().split('T')[0]) ? 'Checked In' : 'Daily Check-in'}
              </button>
              <button className="p-2 bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 rounded-full text-zinc-900 dark:text-white transition-all duration-300 border border-zinc-200 dark:border-white/5 shadow-sm">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mb-8">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-white/10">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Points</p>
                <motion.p 
                  key={profile.points}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  className="font-bold text-zinc-900 dark:text-white"
                >
                  {profile.points?.toLocaleString() || 0}
                </motion.p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-white/10">
              <Flame className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Streak</p>
                <p className="font-bold text-zinc-900 dark:text-white">{profile.streak || 0} Days</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-8 mb-6">
            <div className="text-center md:text-left group cursor-pointer">
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-yellow-400 transition-colors">{posts.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">posts</span>
            </div>
            <div className="text-center md:text-left group cursor-pointer" onClick={() => setShowFollowersModal(true)}>
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-yellow-400 transition-colors">{followers.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">followers</span>
            </div>
            <div className="text-center md:text-left group cursor-pointer" onClick={() => setShowFollowingModal(true)}>
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-yellow-400 transition-colors">{following.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">following</span>
            </div>
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-300 max-w-md mx-auto md:mx-0 leading-relaxed">
            <div className="font-medium text-zinc-900 dark:text-white mb-2 flex items-center justify-center md:justify-start gap-2">
              Health Score: 
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20 font-bold">{profile.healthScore}/100</span>
              <button 
                onClick={handleRecheckHealthScore}
                disabled={recheckingHealth}
                className={clsx(
                  "p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10 transition-all duration-300 text-zinc-500 hover:text-emerald-500",
                  recheckingHealth && "animate-spin text-emerald-500"
                )}
                title="Recheck live health score"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <p>Food lover & health enthusiast. Sharing my journey one meal at a time. 🥗🍕</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center border-t border-zinc-200 dark:border-white/10 mb-10">
        <button 
          onClick={() => setActiveTab('posts')}
          className={clsx(
            "flex items-center gap-2 px-8 py-4 border-t-2 text-sm font-semibold uppercase tracking-widest transition-colors -mt-[1px]",
            activeTab === 'posts' ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "border-transparent text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          )}
        >
          <Grid className="w-4 h-4" /> Posts
        </button>
        <button 
          onClick={() => setActiveTab('saved')}
          className={clsx(
            "flex items-center gap-2 px-8 py-4 border-t-2 text-sm font-semibold uppercase tracking-widest transition-colors -mt-[1px]",
            activeTab === 'saved' ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "border-transparent text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          )}
        >
          <Bookmark className="w-4 h-4" /> Saved
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingSpinner />
      ) : (activeTab === 'posts' ? posts : savedPosts).length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>{activeTab === 'posts' ? 'No posts yet.' : 'No saved posts yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {(activeTab === 'posts' ? posts : savedPosts).map(post => (
            <div 
              key={post.id} 
              className="aspect-square bg-white dark:bg-[#1c1c1e] relative group overflow-hidden cursor-pointer md:rounded-2xl"
              onClick={() => setSelectedPost(post)}
            >
              <img src={post.imageUrl} alt={post.foodType} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4 backdrop-blur-sm p-4">
                <div className="flex items-center gap-4 font-bold text-white text-lg drop-shadow-md">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-6 h-6 fill-white" /> {post.likesCount || 0}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-6 h-6 fill-white" /> {post.commentsCount || 0}
                  </div>
                </div>
                {post.calories !== undefined && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-white font-medium w-full max-w-[150px]">
                    <div className="bg-white/10 rounded px-2 py-1 text-center"><span className="text-zinc-400 block text-[10px] uppercase">Cal</span>{post.calories}</div>
                    <div className="bg-white/10 rounded px-2 py-1 text-center"><span className="text-zinc-400 block text-[10px] uppercase">Pro</span>{post.protein}g</div>
                    <div className="bg-white/10 rounded px-2 py-1 text-center"><span className="text-zinc-400 block text-[10px] uppercase">Carb</span>{post.carbs}g</div>
                    <div className="bg-white/10 rounded px-2 py-1 text-center"><span className="text-zinc-400 block text-[10px] uppercase">Fat</span>{post.fat}g</div>
                  </div>
                )}
              </div>
              <div className={clsx(
                "absolute top-3 right-3 w-3 h-3 rounded-full border border-black/20 shadow-sm",
                post.healthRating === 'High' ? "bg-emerald-500 shadow-emerald-500/50" :
                post.healthRating === 'Medium' ? "bg-yellow-500 shadow-yellow-500/50" : "bg-red-500 shadow-red-500/50"
              )} />
            </div>
          ))}
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowFollowersModal(false)}>
          <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] p-6 max-w-sm w-full relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowFollowersModal(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-900 dark:text-white transition-colors bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-white tracking-tight">Followers</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {followers.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No followers yet.</p>
              ) : (
                followers.map(f => (
                  <div 
                    key={f.id} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/5 p-2 rounded-xl transition-colors"
                    onClick={() => {
                      setShowFollowersModal(false);
                      navigate(`/dashboard/user/${f.followerId}`);
                    }}
                  >
                    <img src={f.followerImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.followerId}`} alt={f.followerName} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <span className="font-medium text-zinc-900 dark:text-white">{f.followerName || 'Unknown User'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowFollowingModal(false)}>
          <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] p-6 max-w-sm w-full relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowFollowingModal(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-900 dark:text-white transition-colors bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-white tracking-tight">Following</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {following.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">Not following anyone yet.</p>
              ) : (
                following.map(f => (
                  <div 
                    key={f.id} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/5 p-2 rounded-xl transition-colors"
                    onClick={() => {
                      setShowFollowingModal(false);
                      navigate(`/dashboard/user/${f.followingId}`);
                    }}
                  >
                    <img src={f.followingImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.followingId}`} alt={f.followingName} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <span className="font-medium text-zinc-900 dark:text-white">{f.followingName || 'Unknown User'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          isOpen={true}
          onClose={() => setSelectedPost(null)}
          onDelete={handleDeletePost}
          onSaveCaption={handleSaveCaption}
          onRescan={handleRescan}
          rescanningId={rescanningId}
          currentUserId={user?.uid}
          isLiked={likedPosts.has(selectedPost.id)}
          onLike={handleLike}
          onOpenComments={(postId, authorId) => setCommentsModalPost({ id: postId, authorId })}
        />
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
