import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Grid, Bookmark, Heart, X, Flame, Trophy, CalendarCheck, ArrowLeft, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import PostModal from '../components/PostModal';
import CommentsModal from '../components/CommentsModal';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [commentsModalPost, setCommentsModalPost] = useState<{id: string, authorId: string} | null>(null);

  useEffect(() => {
    if (!id) return;

    // If it's the current user's profile, redirect to their own profile page
    if (user && id === user.uid) {
      navigate('/dashboard/profile', { replace: true });
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          setProfile({ id: userDoc.id, ...userDoc.data() });
        } else {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Fetch posts
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', id),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch followers
        const followersQ = query(collection(db, 'follows'), where('followingId', '==', id));
        const followersSnap = await getDocs(followersQ);
        const followersData = followersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setFollowers(followersData);

        // Check if current user is following
        if (user) {
          setIsFollowing(followersData.some((f: any) => f.followerId === user.uid));
          
          // Fetch liked posts
          const likesQ = query(collection(db, 'likes'), where('userId', '==', user.uid));
          const likesSnap = await getDocs(likesQ);
          setLikedPosts(new Set(likesSnap.docs.map(doc => doc.data().postId)));
        }

        // Fetch following
        const followingQ = query(collection(db, 'follows'), where('followerId', '==', id));
        const followingSnap = await getDocs(followingQ);
        setFollowing(followingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users/posts/follows/likes');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id, user, navigate]);

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
            actorName: currentUserProfile?.username || user.displayName || 'User',
            actorImage: currentUserProfile?.profileImage || user.photoURL || '',
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
      console.error('Like error:', error);
      handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || !profile) return;

    const followId = `${user.uid}_${profile.id}`;
    const followRef = doc(db, 'follows', followId);
    const userRef = doc(db, 'users', user.uid);
    const targetUserRef = doc(db, 'users', profile.id);

    try {
      if (isFollowing) {
        // Unfollow
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.followerId !== user.uid));
        await deleteDoc(followRef);
        await updateDoc(userRef, { followingCount: increment(-1) });
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
      } else {
        // Follow
        setIsFollowing(true);
        setFollowers(prev => [...prev, {
          followerId: user.uid,
          followerName: user.displayName || 'User',
          followerImage: user.photoURL || '',
          followingId: profile.id
        }]);
        await setDoc(followRef, {
          followerId: user.uid,
          followerName: user.displayName || 'User',
          followerImage: user.photoURL || '',
          followingId: profile.id,
          followingName: profile.username || 'User',
          followingImage: profile.profileImage || '',
          createdAt: new Date().toISOString()
        });
        await updateDoc(userRef, { followingCount: increment(1) });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        
        // Create notification
        const notificationId = `${user.uid}_follow_${profile.id}`;
        await setDoc(doc(db, 'notifications', notificationId), {
          userId: profile.id,
          actorId: user.uid,
          actorName: user.displayName || 'User',
          actorImage: user.photoURL || '',
          type: 'follow',
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      if (isFollowing) {
        setIsFollowing(true);
        setFollowers(prev => [...prev, {
          followerId: user.uid,
          followerName: user.displayName || 'User',
          followerImage: user.photoURL || '',
          followingId: profile.id
        }]);
      } else {
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.followerId !== user.uid));
      }
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center font-sans">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">User not found</h2>
        <button onClick={() => navigate(-1)} className="text-yellow-500 hover:underline flex items-center justify-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans">
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-10 mb-16">
        <div className="relative">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-yellow-500/30 to-purple-500/30">
            <img 
              src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid || profile.id}`} 
              alt={profile.username}
              className="w-full h-full rounded-full border-4 border-white dark:border-black object-cover bg-zinc-100 dark:bg-[#1c1c1e]"
            />
          </div>
          {profile.subscriptionPlan && profile.subscriptionPlan !== 'free' && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg shadow-yellow-500/20 border border-yellow-400/50">
              {profile.subscriptionPlan}
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-5 mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
              {profile.username || 'Unknown User'}
              {profile.isCreator && (
                <span className="text-xs px-3 py-1 bg-blue-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-blue-500/20">Creator</span>
              )}
            </h1>
            <div className="flex items-center justify-center gap-3">
              {user && (
                <>
                  <button 
                    onClick={handleFollowToggle}
                    className={clsx(
                      "px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 shadow-lg",
                      isFollowing
                        ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 border border-transparent"
                        : "bg-yellow-600 text-white hover:bg-yellow-500 shadow-yellow-900/20"
                    )}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/dashboard/messages?to=${profile.id}`);
                    }}
                    className="px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 shadow-lg bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mb-8">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-white/10">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Points</p>
                <p className="font-bold text-zinc-900 dark:text-white">{profile.points?.toLocaleString() || 0}</p>
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
            <p className="font-medium text-zinc-900 dark:text-white mb-2 flex items-center justify-center md:justify-start gap-2">
              Health Score: 
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20 font-bold">{profile.healthScore || 0}/100</span>
            </p>
            <p>{profile.bio || 'Food lover & health enthusiast. Sharing my journey one meal at a time. 🥗🍕'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center border-t border-zinc-200 dark:border-white/10 mb-10">
        <button className="flex items-center gap-2 px-8 py-4 border-t-2 border-zinc-900 dark:border-white text-sm font-semibold uppercase tracking-widest text-zinc-900 dark:text-white -mt-[1px]">
          <Grid className="w-4 h-4" /> Posts
        </button>
      </div>

      {/* Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>No posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {posts.map(post => (
            <div 
              key={post.id} 
              className="aspect-square bg-white dark:bg-[#1c1c1e] relative group overflow-hidden cursor-pointer md:rounded-2xl"
              onClick={() => setSelectedPost(post)}
            >
              <img src={post.imageUrl} alt={post.foodType} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4 backdrop-blur-sm p-4">
                <div className="flex items-center gap-4 font-bold text-white text-lg drop-shadow-md">
                  <div className="flex items-center gap-1.5">
                    <Heart className={clsx("w-6 h-6", likedPosts.has(post.id) ? "fill-yellow-500 text-yellow-500" : "fill-white text-white")} /> {post.likesCount || 0}
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
