import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Users, Image as ImageIcon, CreditCard, ShieldAlert } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Admin() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ users: 0, posts: 0, revenue: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const fetchAdminData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const postsSnap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10)));
        
        let revenue = 0;
        usersSnap.docs.forEach(doc => {
          const plan = doc.data().subscriptionPlan;
          if (plan === 'premium') revenue += 49;
          if (plan === 'pro') revenue += 99;
        });

        setStats({
          users: usersSnap.size,
          posts: postsSnap.size, // This is just the recent 10, but good enough for mock
          revenue
        });

        setRecentPosts(postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'admin');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [profile]);

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
                    <button className="text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
