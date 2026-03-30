import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Award } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Health() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isSubscribed = profile?.subscriptionPlan === 'pro' || profile?.subscriptionPlan === 'premium';

  useEffect(() => {
    if (!user || !isSubscribed) {
      if (!isSubscribed) setLoading(false);
      return;
    }

    const fetchPosts = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isSubscribed) {
    return (
      <div className="max-w-4xl mx-auto pb-24 flex flex-col items-center justify-center text-center space-y-8 py-20">
        <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 shadow-xl shadow-yellow-500/10">
          <Activity className="w-12 h-12 text-yellow-500" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Health Dashboard is Premium</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed">
            Unlock your personalized health dashboard, meal breakdowns, and nutritional trends with a Pro or Premium subscription.
          </p>
        </div>
        <a 
          href="/dashboard/subscription"
          className="px-10 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-yellow-900/20 hover:scale-105 active:scale-95"
        >
          View Subscription Plans
        </a>
      </div>
    );
  }

  // Calculate stats
  const totalMeals = posts.length;
  const healthyMeals = posts.filter(p => p.healthRating === 'High').length;
  const mediumMeals = posts.filter(p => p.healthRating === 'Medium').length;
  const lowMeals = posts.filter(p => p.healthRating === 'Low').length;

  const pieData = [
    { name: 'Healthy', value: healthyMeals, color: '#10b981' },
    { name: 'Moderate', value: mediumMeals, color: '#eab308' },
    { name: 'Unhealthy', value: lowMeals, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Group by category
  const categoryCount: Record<string, number> = {};
  posts.forEach(p => {
    categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
  });
  const barData = Object.entries(categoryCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-10 font-sans">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Health Dashboard</h1>
        <div className="px-5 py-2.5 bg-yellow-500/10 text-yellow-400 rounded-full font-bold flex items-center gap-2 border border-yellow-500/20 shadow-sm shadow-yellow-500/10">
          <Activity className="w-5 h-5" /> Score: {profile?.healthScore}/100
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Total Meals Tracked', value: totalMeals, icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Healthy Choices', value: healthyMeals, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Moderate Choices', value: mediumMeals, icon: Activity, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Unhealthy Choices', value: lowMeals, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
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

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {/* Pie Chart */}
        <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-8 rounded-[2rem] shadow-lg shadow-zinc-200/50 dark:shadow-black/20">
          <h2 className="text-xl font-semibold mb-8 text-zinc-900 dark:text-white tracking-tight">Health Rating Breakdown</h2>
          {totalMeals > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(28, 28, 30, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(12px)' }}
                    itemStyle={{ color: '#fff', fontWeight: 500 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-6">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                    <span className="text-zinc-600 dark:text-zinc-300">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500 font-medium">No data available</div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-8 rounded-[2rem] shadow-lg shadow-zinc-200/50 dark:shadow-black/20">
          <h2 className="text-xl font-semibold mb-8 text-zinc-900 dark:text-white tracking-tight">Top Food Categories</h2>
          {barData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgba(28, 28, 30, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(12px)' }}
                    itemStyle={{ color: '#fff', fontWeight: 500 }}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-zinc-500 font-medium">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
