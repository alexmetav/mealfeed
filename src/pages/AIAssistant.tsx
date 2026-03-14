import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Bot, Sparkles, Loader2, UtensilsCrossed } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

export default function AIAssistant() {
  const { user, profile } = useAuth();
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || profile?.subscriptionPlan === 'free') {
      setLoading(false);
      return;
    }

    const fetchInsights = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            foodType: data.foodType,
            healthScore: data.healthScore,
            date: data.createdAt
          };
        });

        if (history.length > 0) {
          // Mocking AI insights as requested
          setTimeout(() => {
            setInsights(`
### Weekly Nutrition Summary

Based on your recent meals, you're maintaining a solid balance of nutrients. 

**Key Observations:**
- Your average health score is **${(history.reduce((acc, curr) => acc + curr.healthScore, 0) / history.length).toFixed(1)}/100**.
- You've been consistent with your meal tracking, which is the first step to a healthier lifestyle.

**Recommendations:**
1. **Increase Fiber:** Try adding more leafy greens to your dinners.
2. **Hydration:** Remember to drink at least 2L of water daily.
3. **Protein Balance:** Your protein intake looks good, but consider plant-based sources like lentils or chickpeas.

Keep up the great work!
            `);
            setLoading(false);
          }, 2000);
          return; // Exit early as we are using mock data
        } else {
          setInsights("You haven't uploaded any meals yet! Start tracking your food to get personalized AI insights.");
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts');
        setInsights("Failed to load insights.");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [user, profile]);

  if (profile?.subscriptionPlan === 'free') {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-8 font-sans">
        <div className="w-24 h-24 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-orange-500/20 border border-orange-500/20">
          <Sparkles className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">AI Health Assistant</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed">
          Upgrade to AI Pro to unlock personalized health insights, weekly reports, and advanced diet recommendations based on your eating habits.
        </p>
        <button className="px-10 py-4 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-500 transition-all duration-300 shadow-lg shadow-orange-900/30 text-lg">
          Upgrade to AI Pro
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-24 font-sans">
      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-purple-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Bot className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">Your AI Nutritionist</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Personalized insights based on your recent meals</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] p-10 min-h-[400px] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 py-32">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative bg-white dark:bg-[#1c1c1e] p-5 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl"
            >
              <UtensilsCrossed className="w-8 h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
            </motion.div>
            <div className="flex flex-col items-center gap-3">
              <p className="font-medium text-zinc-900 dark:text-white text-lg tracking-tight">Analyzing your eating habits...</p>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }} 
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert prose-orange max-w-none prose-p:leading-relaxed prose-headings:tracking-tight prose-headings:font-semibold relative z-10">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
