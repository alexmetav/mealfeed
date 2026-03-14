import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Settings, Grid, Bookmark, Heart, X, Flame, Trophy, CalendarCheck } from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchPostsAndFollows = async () => {
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
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts/follows');
      } finally {
        setLoading(false);
      }
    };

    fetchPostsAndFollows();
  }, [user]);

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
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-orange-500/30 to-purple-500/30">
            <img 
              src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
              alt={profile.username}
              className="w-full h-full rounded-full border-4 border-white dark:border-black object-cover bg-zinc-100 dark:bg-[#1c1c1e]"
            />
          </div>
          {profile.subscriptionPlan !== 'free' && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg shadow-orange-500/20 border border-orange-400/50">
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
                    : "bg-orange-600 text-white hover:bg-orange-500 shadow-orange-900/20"
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
                <p className="font-bold text-zinc-900 dark:text-white">{profile.points?.toLocaleString() || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-white/10">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Streak</p>
                <p className="font-bold text-zinc-900 dark:text-white">{profile.streak || 0} Days</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-8 mb-6">
            <div className="text-center md:text-left group cursor-pointer">
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-orange-400 transition-colors">{posts.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">posts</span>
            </div>
            <div className="text-center md:text-left group cursor-pointer" onClick={() => setShowFollowersModal(true)}>
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-orange-400 transition-colors">{followers.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">followers</span>
            </div>
            <div className="text-center md:text-left group cursor-pointer" onClick={() => setShowFollowingModal(true)}>
              <span className="font-semibold text-xl text-zinc-900 dark:text-white group-hover:text-orange-400 transition-colors">{following.length}</span> <span className="text-zinc-500 dark:text-zinc-400 text-sm">following</span>
            </div>
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-300 max-w-md mx-auto md:mx-0 leading-relaxed">
            <p className="font-medium text-zinc-900 dark:text-white mb-2 flex items-center justify-center md:justify-start gap-2">
              Health Score: 
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20 font-bold">{profile.healthScore}/100</span>
            </p>
            <p>Food lover & health enthusiast. Sharing my journey one meal at a time. 🥗🍕</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center border-t border-zinc-200 dark:border-white/10 mb-10">
        <button className="flex items-center gap-2 px-8 py-4 border-t-2 border-zinc-900 dark:border-white text-sm font-semibold uppercase tracking-widest text-zinc-900 dark:text-white -mt-[1px]">
          <Grid className="w-4 h-4" /> Posts
        </button>
        <button className="flex items-center gap-2 px-8 py-4 text-sm font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 transition-colors">
          <Bookmark className="w-4 h-4" /> Saved
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>No posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {posts.map(post => (
            <div key={post.id} className="aspect-square bg-white dark:bg-[#1c1c1e] relative group overflow-hidden cursor-pointer md:rounded-2xl">
              <img src={post.imageUrl} alt={post.foodType} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 font-bold text-white text-lg drop-shadow-md">
                  <Heart className="w-6 h-6 fill-white" /> {post.likesCount}
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
                  <div key={f.id} className="flex items-center gap-3">
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
                  <div key={f.id} className="flex items-center gap-3">
                    <img src={f.followingImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.followingId}`} alt={f.followingName} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <span className="font-medium text-zinc-900 dark:text-white">{f.followingName || 'Unknown User'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
