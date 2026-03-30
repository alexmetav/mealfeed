import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Coins, Flame, Calendar as CalendarIcon, ArrowRight, CheckCircle2, Users, Star, Copy, Loader2 } from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs, increment } from 'firebase/firestore';
import { db } from '../firebase';
import clsx from 'clsx';

import { motion, AnimatePresence } from 'framer-motion';
import { usePoints } from '../context/PointsContext';

export default function Rewards() {
  const { user, profile, refreshProfile } = useAuth();
  const { showPoints } = usePoints();
  const [referralInput, setReferralInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!profile || !user) return null;

  const handleCopyReferral = () => {
    const code = profile.referralCode || user.uid.slice(0, 8).toUpperCase();
    navigator.clipboard.writeText(code);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSubmitReferral = async () => {
    if (!referralInput.trim()) return;
    if (profile.referredBy) {
      alert('You have already used a referral code.');
      return;
    }
    const myCode = profile.referralCode || user.uid.slice(0, 8).toUpperCase();
    if (referralInput.toUpperCase() === myCode) {
      alert('You cannot use your own referral code.');
      return;
    }

    setReferralLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('referralCode', '==', referralInput.toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert('Invalid referral code.');
        setReferralLoading(false);
        return;
      }

      const referrerDoc = snapshot.docs[0];
      const referrerId = referrerDoc.id;

      // Update current user
      const userRef = doc(db, 'users', user.uid);
      showPoints(1000, 'Referral Bonus');
      await updateDoc(userRef, {
        referredBy: referralInput.toUpperCase(),
        points: increment(1000)
      });

      // Update referrer
      const referrerRef = doc(db, 'users', referrerId);
      await updateDoc(referrerRef, {
        referralsCount: increment(1),
        points: increment(5000)
      });

      alert('Referral code applied! You earned 1000 points.');
      setReferralInput('');
      refreshProfile();
    } catch (error) {
      console.error(error);
      alert('Error applying referral code.');
    }
    setReferralLoading(false);
  };

  const handleClaimCreator = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isCreator: true });
      alert('Congratulations! You are now a Creator. Enjoy your 2x points boost!');
      refreshProfile();
    } catch (error) {
      console.error(error);
    }
  };

  // Calculate estimated tokens (e.g., 1000 points = 1 $NUTRI)
  const estimatedTokens = Math.floor((profile.points || 0) / 1000);
  
  // Generate calendar days for the current month
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const checkInHistory = profile.checkInHistory || [];
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentYear, currentMonth, i + 1);
    // Format as YYYY-MM-DD in local time to match check-in logic
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return {
      day: i + 1,
      dateString,
      checkedIn: checkInHistory.includes(dateString),
      isToday: dateString === todayString,
      isFuture: date > today
    };
  });

  // Pad the beginning of the month
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div className="max-w-3xl mx-auto pb-24 font-sans space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">Rewards & TGE</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Earn points and convert them to $NUTRI tokens.</p>
      </div>

      {/* Points & Token Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-yellow-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-6 h-6 text-yellow-200" />
              <span className="font-semibold text-yellow-100 uppercase tracking-wider text-sm">Total Points</span>
            </div>
            <motion.div 
              key={profile.points}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              className="text-5xl font-bold tracking-tight mb-2"
            >
              {(profile.points || 0).toLocaleString()}
            </motion.div>
            <p className="text-yellow-200 text-sm">Keep earning by uploading and engaging!</p>
          </div>
        </div>

        <div className="bg-zinc-900 dark:bg-[#1c1c1e] rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Coins className="w-6 h-6 text-emerald-400" />
              <span className="font-semibold text-zinc-400 uppercase tracking-wider text-sm">Estimated $NUTRI</span>
            </div>
            <div className="text-5xl font-bold tracking-tight mb-2 text-emerald-400 blur-xl select-none">
              {estimatedTokens.toLocaleString()}
            </div>
            <p className="text-zinc-400 text-sm flex items-center gap-1">
              Conversion rate: <span className="blur-md select-none">??? Points = 1 $NUTRI</span>
            </p>
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-xs text-emerald-300 leading-relaxed">
                <strong>TGE (Token Generation Event)</strong> is approaching. Your points will automatically convert to $NUTRI tokens on the BNB Smart Chain after TGE.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Earn */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-yellow-500" /> How to Earn
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5">
            <div className="font-bold text-lg text-zinc-900 dark:text-white mb-1">+1,000</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Daily Check-in</div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5">
            <div className="font-bold text-lg text-zinc-900 dark:text-white mb-1">+100</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Upload a Meal</div>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/5">
            <div className="font-bold text-lg text-zinc-900 dark:text-white mb-1">+50</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Like a Post</div>
          </div>
        </div>
      </div>

      {/* Creator Program */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-500" /> Creator Program
          </h2>
          {profile.isCreator && (
            <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-500/20">
              Active (2x Boost)
            </span>
          )}
        </div>
        
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Become a Creator to earn 2x points on all activities! Requirements: 10 followers and 5 posts.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-900 dark:text-white font-medium">Followers</span>
              <span className="text-zinc-500 dark:text-zinc-400">{profile.followersCount || 0} / 10</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-white/5 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(((profile.followersCount || 0) / 10) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-900 dark:text-white font-medium">Posts</span>
              <span className="text-zinc-500 dark:text-zinc-400">{profile.postsCount || 0} / 5</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-white/5 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(((profile.postsCount || 0) / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {!profile.isCreator && (
          <button 
            onClick={handleClaimCreator}
            disabled={(profile.followersCount || 0) < 10 || (profile.postsCount || 0) < 5}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
          >
            Claim Creator Badge
          </button>
        )}
      </div>

      {/* Refer & Earn */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" /> Refer & Earn
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Your Code */}
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Share your code with friends. When they sign up and use it, you earn <strong className="text-emerald-500">5,000 points</strong> and they earn 1,000 points!
            </p>
            <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-4 flex items-center justify-between mb-4">
              <div className="font-mono text-lg font-bold text-zinc-900 dark:text-white tracking-widest">
                {profile.referralCode || user.uid.slice(0, 8).toUpperCase()}
              </div>
              <button 
                onClick={handleCopyReferral}
                className="p-2 bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 rounded-lg text-zinc-900 dark:text-white transition-colors"
                title="Copy Code"
              >
                {copySuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              Total Referrals: <span className="text-emerald-500">{profile.referralsCount || 0}</span>
            </div>
          </div>

          {/* Enter Code */}
          <div className="border-t md:border-t-0 md:border-l border-zinc-200 dark:border-white/10 pt-6 md:pt-0 md:pl-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Were you referred by a friend? Enter their code below to claim your <strong className="text-emerald-500">1,000 points</strong> bonus.
            </p>
            {profile.referredBy ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">You used code: <strong>{profile.referredBy}</strong></span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  placeholder="Enter referral code"
                  className="flex-1 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 uppercase font-mono"
                />
                <button 
                  onClick={handleSubmitReferral}
                  disabled={referralLoading || !referralInput.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {referralLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Streak Calendar */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-1">
              <CalendarIcon className="w-5 h-5 text-yellow-500" /> Check-in Streak
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Check in daily to build your streak.</p>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 rounded-full border border-yellow-500/20">
            <Flame className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-yellow-600 dark:text-yellow-400">{profile.streak || 0} Days</span>
          </div>
        </div>

        <div className="mb-4 text-center font-semibold text-zinc-900 dark:text-white">
          {today.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {paddingDays.map(i => (
            <div key={`pad-${i}`} className="aspect-square rounded-xl bg-transparent" />
          ))}
          {days.map((d) => (
            <div 
              key={d.day} 
              className={clsx(
                "aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all relative",
                d.checkedIn 
                  ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/20" 
                  : d.isToday
                    ? "bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-2 border-yellow-500"
                    : d.isFuture
                      ? "bg-zinc-50 dark:bg-white/5 text-zinc-300 dark:text-zinc-600"
                      : "bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400"
              )}
            >
              {d.checkedIn ? <CheckCircle2 className="w-5 h-5" /> : d.day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
