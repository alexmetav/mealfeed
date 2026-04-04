import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Medal, Crown, Flame, Star, ArrowRight, Target, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface LeaderboardUser {
  uid: string;
  username: string;
  profileImage?: string;
  points: number;
  streak: number;
  isCreator?: boolean;
}

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalParticipants, setTotalParticipants] = useState(0);

  useEffect(() => {
    const fetchTotalParticipants = async () => {
      try {
        const coll = collection(db, 'users');
        const q = query(coll, where('points', '>', 0));
        const snapshot = await getCountFromServer(q);
        // Simulate 8K+ participants as requested
        setTotalParticipants(8432 + snapshot.data().count);
      } catch (error) {
        console.error('Error fetching total participants:', error);
        setTotalParticipants(8432);
      }
    };

    fetchTotalParticipants();

    const q = query(
      collection(db, 'users'),
      where('points', '>', 0),
      orderBy('points', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as LeaderboardUser));
      setTopUsers(users);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans space-y-12">
      <header className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/10 rounded-full border-2 border-yellow-500/20 mb-4"
        >
          <Trophy className="w-10 h-10 text-yellow-500" />
        </motion.div>
        <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
          Hall of Fame
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          The top 10 nutrition champions of the week. Earn points to climb the ranks!
        </p>
      </header>

      {/* Weekly Challenge Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest">
              <Zap className="w-4 h-4 fill-current" /> Active Challenge
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-none">
              THE 7-DAY <br /> <span className="text-yellow-400">CLEAN EAT</span> STREAK
            </h2>
            <p className="text-indigo-100 text-sm leading-relaxed max-w-sm">
              Post 7 healthy meals in a row this week to earn a <span className="font-bold text-white">5,000 Points Bonus</span> and a limited edition profile badge.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl border border-white/10">
                <Target className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold">Goal: 7 Posts</span>
              </div>
              <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-xl border border-white/10">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold">{totalParticipants.toLocaleString()} Participating</span>
              </div>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <Link 
              to="/dashboard/upload"
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-tighter hover:bg-yellow-400 hover:text-black transition-all duration-300 shadow-xl"
            >
              Join Challenge <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Leaderboard List */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-zinc-200 dark:border-white/10 shadow-2xl shadow-zinc-200/50 dark:shadow-black/20 overflow-hidden">
        <div className="p-8 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Medal className="w-6 h-6 text-yellow-500" /> Global Rankings
          </h3>
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Updated Hourly
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-white/5">
          {topUsers.map((user, index) => (
            <motion.div 
              key={user.uid}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className={clsx(
                "flex items-center gap-4 p-6 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group",
                index === 0 && "bg-yellow-500/5 dark:bg-yellow-500/10"
              )}
            >
              <div className="w-10 text-center">
                {index === 0 ? (
                  <Crown className="w-8 h-8 text-yellow-500 mx-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                ) : (
                  <span className="text-2xl font-black text-zinc-300 dark:text-zinc-700">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              <Link to={`/dashboard/user/${user.uid}`} className="flex items-center gap-4 flex-1">
                <div className="relative">
                  <img 
                    src={user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt={user.username}
                    className="w-12 h-12 rounded-full border-2 border-zinc-200 dark:border-white/10 object-cover"
                  />
                  {index < 3 && (
                    <div className={clsx(
                      "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-[#1c1c1e]",
                      index === 0 ? "bg-yellow-500 text-white" :
                      index === 1 ? "bg-zinc-300 text-zinc-900" :
                      "bg-orange-400 text-white"
                    )}>
                      {index + 1}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-white group-hover:text-yellow-500 transition-colors">
                      {user.username}
                    </span>
                    {user.isCreator && (
                      <Star className="w-3 h-3 text-blue-500 fill-current" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500" /> {user.streak || 0} Day Streak
                    </span>
                  </div>
                </div>
              </Link>

              <div className="text-right">
                <div className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">
                  {user.points.toLocaleString()}
                </div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Points
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-center">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Fast Points</h4>
          <p className="text-xs text-zinc-500">Upload daily to get streak multipliers.</p>
        </div>
        <div className="p-6 rounded-3xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-center">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Star className="w-5 h-5 text-blue-500" />
          </div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Creator Bonus</h4>
          <p className="text-xs text-zinc-500">Creators earn 2x points on all activities.</p>
        </div>
        <div className="p-6 rounded-3xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-center">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Referral Boost</h4>
          <p className="text-xs text-zinc-500">Get 5,000 points for every friend you invite.</p>
        </div>
      </div>
    </div>
  );
}
