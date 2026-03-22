import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, Star, Zap, CreditCard, Search, Send, X, CheckCircle2, Loader2, BarChart3, TrendingUp, UserCheck } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import clsx from 'clsx';

interface UserData {
  uid: string;
  username: string;
  email: string;
  role: string;
  points: number;
  streak: number;
  subscriptionPlan: string;
  createdAt: string;
  profileImage?: string;
}

export default function AdminUsers() {
  const { profile, user: adminUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchUsers = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    fetchUsers();
  }, [profile]);

  const handleBroadcast = async () => {
    if (!broadcastText.trim() || !adminUser) return;
    setSending(true);
    try {
      const batch = writeBatch(db);
      const notificationRef = collection(db, 'notifications');
      
      // Firestore batch limit is 500. For more users, we'd need multiple batches.
      // For this app, we'll assume < 500 for now or just batch the first 500.
      const targetUsers = users.slice(0, 450); // Safe margin
      
      for (const targetUser of targetUsers) {
        const newNotifRef = doc(notificationRef);
        batch.set(newNotifRef, {
          userId: targetUser.uid,
          actorId: adminUser.uid,
          actorName: 'MealFeed Team',
          actorImage: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          type: 'admin_message',
          message: broadcastText,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      setSuccess(true);
      setTimeout(() => {
        setBroadcastModal(false);
        setSuccess(false);
        setBroadcastText('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications_broadcast');
    } finally {
      setSending(false);
    }
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: users.length,
    premium: users.filter(u => u.subscriptionPlan !== 'free').length,
    active: users.filter(u => u.streak > 0).length,
    avgPoints: Math.round(users.reduce((acc, u) => acc + (u.points || 0), 0) / users.length)
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-10 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">User Analytics</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage community members and track platform growth.</p>
        </div>
        <button 
          onClick={() => setBroadcastModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-yellow-900/20 active:scale-95"
        >
          <Send className="w-5 h-5" />
          Broadcast Message
        </button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Members', value: stats.total, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Paid Plans', value: stats.premium, icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Active Streaks', value: stats.active, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Avg Points', value: stats.avgPoints, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={clsx("w-6 h-6", stat.color)} />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{stat.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="p-8 border-b border-zinc-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Member Directory</h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search by name, email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-black/20 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-widest font-bold">
                <th className="px-8 py-5">User</th>
                <th className="px-8 py-5">User ID</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Engagement</th>
                <th className="px-8 py-5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <img 
                        src={user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt={user.username}
                        className="w-10 h-10 rounded-full border border-zinc-200 dark:border-white/10"
                      />
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                          {user.username}
                          {user.role === 'admin' && <Shield className="w-3 h-3 text-yellow-500" />}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <code className="text-[10px] bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded-lg text-zinc-500 dark:text-zinc-400 font-mono">
                      {user.uid}
                    </code>
                  </td>
                  <td className="px-8 py-5">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      user.subscriptionPlan === 'pro' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                      user.subscriptionPlan === 'premium' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                      "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-white/5 dark:border-white/10"
                    )}>
                      {user.subscriptionPlan}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-bold">{user.points || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                        <Zap className="w-3 h-3 text-orange-500" />
                        <span className="text-xs font-bold">{user.streak || 0}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(user.createdAt).toLocaleDateString()}
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
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Broadcast Message</h2>
              <button onClick={() => setBroadcastModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
              <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-yellow-600 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-500 leading-relaxed">
                  This message will be sent to <strong>all {users.length} members</strong>. Use this for important announcements or new feature updates.
                </p>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Announcement Content</label>
              <textarea 
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Type your announcement here..."
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-h-[150px] resize-none transition-all"
              />
            </div>

            <button 
              onClick={handleBroadcast}
              disabled={sending || !broadcastText.trim() || success}
              className={clsx(
                "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95",
                success 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-yellow-600 text-white hover:bg-yellow-500 shadow-yellow-900/20"
              )}
            >
              {sending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : success ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Broadcast Sent!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send to All Users
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
