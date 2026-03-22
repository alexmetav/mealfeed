import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Users, Image as ImageIcon, CreditCard, ShieldAlert, MessageSquare, Trash2, X, Send, CheckCircle2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import clsx from 'clsx';

export default function Admin() {
  const { profile, user: adminUser } = useAuth();
  const [stats, setStats] = useState({ users: 0, posts: 0, revenue: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageModal, setMessageModal] = useState<{ show: boolean; userId: string; userName: string } | null>(null);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const fetchAdminData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc')));
      
      const allPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let revenue = 0;
      const userStatsMap: Record<string, any> = {};

      usersSnap.docs.forEach(doc => {
        const userData = doc.data();
        const plan = userData.subscriptionPlan;
        if (plan === 'premium') revenue += 49;
        if (plan === 'pro') revenue += 99;

        userStatsMap[userData.uid] = {
          uid: userData.uid,
          username: userData.username,
          topPostLikes: 0,
          postCount: 0
        };
      });

      allPosts.forEach((post: any) => {
        if (userStatsMap[post.userId]) {
          userStatsMap[post.userId].postCount++;
          if (post.likesCount > userStatsMap[post.userId].topPostLikes) {
            userStatsMap[post.userId].topPostLikes = post.likesCount;
          }
        }
      });

      const analytics = Object.values(userStatsMap).sort((a: any, b: any) => b.topPostLikes - a.topPostLikes);

      setStats({
        users: usersSnap.size,
        posts: postsSnap.size,
        revenue
      });

      setRecentPosts(allPosts.slice(0, 20));
      setUserAnalytics(analytics);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    fetchAdminData();
  }, [profile]);

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setRecentPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const handleSendMessage = async () => {
    if (!messageModal || !messageText.trim() || !adminUser) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: messageModal.userId,
        actorId: adminUser.uid,
        actorName: 'MealFeed Admin',
        actorImage: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        type: 'admin_message',
        message: messageText,
        read: false,
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => {
        setMessageModal(null);
        setSuccess(false);
        setMessageText('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastText.trim() || !adminUser) return;
    setBroadcasting(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = usersSnap.docs.map(userDoc => {
        return addDoc(collection(db, 'notifications'), {
          userId: userDoc.id,
          actorId: adminUser.uid,
          actorName: 'MealFeed Admin',
          actorImage: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          type: 'admin_message',
          message: broadcastText,
          read: false,
          createdAt: new Date().toISOString()
        });
      });
      
      await Promise.all(batch);
      
      setBroadcastSuccess(true);
      setTimeout(() => {
        setBroadcastModal(false);
        setBroadcastSuccess(false);
        setBroadcastText('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setBroadcasting(false);
    }
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-10 font-sans">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Admin Dashboard</h1>
        <button 
          onClick={() => setBroadcastModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-yellow-900/20 active:scale-95"
        >
          <Send className="w-5 h-5" />
          Broadcast Update
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Total Users', value: stats.users, icon: Users, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Total Posts', value: stats.posts, icon: ImageIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Monthly Revenue', value: `$${stats.revenue}`, icon: CreditCard, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Reports', value: 0, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 rounded-[2rem] flex flex-col items-center text-center shadow-lg shadow-zinc-200/50 dark:shadow-black/20 hover:bg-zinc-50 dark:hover:bg-[#242426] transition-colors duration-300">
            <div className={`p-3 rounded-2xl mb-4 ${stat.bg}`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <span className="text-3xl font-bold mb-1 text-zinc-900 dark:text-white tracking-tight">{stat.value}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="p-6 border-b border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">User Analytics (Sorted by Top Post)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-black/20 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">User ID</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Username</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Top Post Likes</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Total Posts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {userAnalytics.map((user) => (
                <tr key={user.uid} className="hover:bg-zinc-100 dark:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{user.uid}</td>
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      {user.topPostLikes} Likes
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">{user.postCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="p-6 border-b border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">Recent Posts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-black/20 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Author</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Food</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Rating</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentPosts.map((post) => (
                <tr key={post.id} className="hover:bg-zinc-100 dark:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{post.authorName}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">{post.foodType}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                      post.healthRating === 'High' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      post.healthRating === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {post.healthRating}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setMessageModal({ show: true, userId: post.userId, userName: post.authorName })}
                        className="p-2 text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
                        title="Send Message"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Post"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Modal */}
      {broadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-zinc-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Broadcast Update</h2>
              <button onClick={() => setBroadcastModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Broadcast Message</label>
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type the update message for all users..."
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-h-[150px] resize-none transition-all"
              />
              <p className="mt-2 text-[10px] text-zinc-500">This message will be sent to ALL registered users.</p>
            </div>

            <button 
              onClick={handleBroadcast}
              disabled={broadcasting || !broadcastText.trim() || broadcastSuccess}
              className={clsx(
                "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95",
                broadcastSuccess 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-yellow-600 text-white hover:bg-yellow-500 shadow-yellow-900/20"
              )}
            >
              {broadcasting ? (
                <LoadingSpinner />
              ) : broadcastSuccess ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Broadcasted Successfully
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Broadcast
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {messageModal?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-zinc-200 dark:border-white/10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Send Message</h2>
              <button onClick={() => setMessageModal(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Recipient</p>
              <div className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 font-bold">
                  {messageModal.userName[0]}
                </div>
                <span className="font-semibold text-zinc-900 dark:text-white">{messageModal.userName}</span>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Message Content</label>
              <textarea 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here..."
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-h-[150px] resize-none transition-all"
              />
            </div>

            <button 
              onClick={handleSendMessage}
              disabled={sending || !messageText.trim() || success}
              className={clsx(
                "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95",
                success 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-yellow-600 text-white hover:bg-yellow-500 shadow-yellow-900/20"
              )}
            >
              {sending ? (
                <LoadingSpinner />
              ) : success ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Sent Successfully
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
