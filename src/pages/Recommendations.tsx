import { useState, useEffect } from 'react';
import { Utensils, Globe, Target, ShoppingCart, Activity, Flame, ChevronRight, Loader2, Candy, Pizza } from 'lucide-react';
import { aiJson } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface MealRecommendation {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  groceryList: string[];
}

interface UserPost {
  foodType: string;
  healthScore: number;
}

export default function Recommendations() {
  const { user, profile } = useAuth();
  const [goal, setGoal] = useState('Weight Loss');
  const [healthLevel, setHealthLevel] = useState('Very Healthy');
  const [recType, setRecType] = useState('Healthy Lifestyle');
  const [cuisine, setCuisine] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<MealRecommendation[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);

  const isSubscribed = profile?.subscriptionPlan === 'pro' || profile?.subscriptionPlan === 'premium';

  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!user || !isSubscribed) return;
      try {
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const posts = snapshot.docs.map(doc => doc.data() as UserPost);
        setUserPosts(posts);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    };

    fetchUserPosts();
  }, [user]);

  const handleGenerate = async () => {
    if (!cuisine.trim()) {
      alert('Please enter a cuisine or country.');
      return;
    }

    setLoading(true);
    try {
      const recentMeals = userPosts
        .map(p => p.foodType)
        .filter(Boolean)
        .join(', ');

      const prompt = `Act as an expert nutritionist. The user wants meal recommendations.
      
      User's Recent Meals: ${recentMeals || 'No recent data'}
      Recommendation Type: ${recType}
      Goal: ${goal}
      Health Level: ${healthLevel}
      Cuisine/Country: ${cuisine}
      
      Based on their recent meals, suggest 3 ${recType === 'Healthy Lifestyle' ? 'balanced meals' : recType} that fit their goal and health level.
      If the type is "Safe Street Food", suggest healthier versions of popular street foods from the specified cuisine.
      If the type is "Healthy Sweets", suggest low-calorie or high-protein sweet alternatives that satisfy cravings.
      
      Return the response as a JSON object with a "meals" key containing an array of objects.
      Each meal object must have these fields:
      - name: string
      - description: string
      - calories: number
      - protein: number
      - carbs: number
      - fat: number
      - groceryList: string[] (list of items to buy from the market)
      
      Example format:
      {
        "meals": [
          {
            "name": "Grilled Chicken Salad",
            "description": "A fresh salad with grilled chicken breast...",
            "calories": 350,
            "protein": 35,
            "carbs": 10,
            "fat": 15,
            "groceryList": ["Chicken breast", "Mixed greens", "Olive oil"]
          }
        ]
      }`;

      const response = await aiJson(prompt);
      
      if (response) {
        let cleanedResponse = response.trim();
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        }
        
        const data = JSON.parse(cleanedResponse);
        // Handle both direct array and object with array
        const finalData = Array.isArray(data) ? data : (data.meals || data.recommendations || data.options || []);
        
        if (finalData.length === 0) {
          throw new Error("No recommendations found in AI response");
        }
        
        setRecommendations(finalData);
      }
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      let errorMsg = 'Failed to generate recommendations. Please try again.';
      if (error.message?.toLowerCase().includes('quota') || error.message?.includes('429')) {
        errorMsg = "AI Quota Exceeded. Please wait a minute or check your OpenAI billing settings.";
      }
      if (error.message?.toLowerCase().includes('insufficient balance') || error.message?.includes('402')) {
        errorMsg = "Insufficient Balance. Please top up your OpenAI account.";
      }
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isSubscribed) {
    return (
      <div className="max-w-4xl mx-auto pb-24 flex flex-col items-center justify-center text-center space-y-8 py-20">
        <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20 shadow-xl shadow-orange-500/10">
          <Utensils className="w-12 h-12 text-orange-500" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">Meal Recommendations are Premium</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed">
            Get personalized meal suggestions, grocery lists, and nutritional plans tailored to your goals with a Pro or Premium subscription.
          </p>
        </div>
        <a 
          href="/dashboard/subscription"
          className="px-10 py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-orange-900/20 hover:scale-105 active:scale-95"
        >
          View Subscription Plans
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 font-sans space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">Meal Recommendations</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Discover meals tailored to your goals, health preferences, and favorite cuisines.</p>
      </div>

      {/* Form Section */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Recommendation Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Utensils className="w-4 h-4 text-orange-500" /> Recommendation Type
            </label>
            <select 
              value={recType}
              onChange={(e) => setRecType(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="Healthy Lifestyle">Healthy Lifestyle</option>
              <option value="Safe Street Food">Safe Street Food</option>
              <option value="Healthy Sweets">Healthy Sweets</option>
            </select>
          </div>

          {/* Goal */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Target className="w-4 h-4 text-yellow-500" /> Your Goal
            </label>
            <select 
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            >
              <option value="Weight Loss">Weight Loss</option>
              <option value="Weight Gain">Weight Gain</option>
              <option value="Maintenance">Maintenance</option>
              <option value="High Protein">High Protein</option>
              <option value="Low Carb">Low Carb</option>
            </select>
          </div>

          {/* Health Level */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Activity className="w-4 h-4 text-emerald-500" /> Health Level
            </label>
            <select 
              value={healthLevel}
              onChange={(e) => setHealthLevel(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="Very Healthy">Very Healthy</option>
              <option value="Average">Average</option>
              <option value="A Little Healthy">A Little Healthy</option>
              <option value="Cheat Meal">Cheat Meal</option>
            </select>
          </div>

          {/* Cuisine/Country */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Globe className="w-4 h-4 text-blue-500" /> Cuisine / Country
            </label>
            <input 
              type="text"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g. Italian, Indian, Mexican..."
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={loading || !cuisine.trim()}
          className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-900/20"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generating Meals...</>
          ) : (
            <><Utensils className="w-5 h-5" /> Get Recommendations</>
          )}
        </button>
      </div>

      {/* Results Section */}
      {recommendations.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-yellow-500" /> Suggested Meals
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => (
              <div key={index} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-lg shadow-zinc-200/50 dark:shadow-black/20 flex flex-col">
                <div className="p-6 flex-1">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{rec.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 line-clamp-3">{rec.description}</p>
                  
                  {/* Macros */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-3 text-center border border-zinc-200 dark:border-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Calories</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{rec.calories}</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-3 text-center border border-zinc-200 dark:border-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Protein</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{rec.protein}g</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-3 text-center border border-zinc-200 dark:border-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Carbs</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{rec.carbs}g</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-3 text-center border border-zinc-200 dark:border-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Fat</div>
                      <div className="font-bold text-zinc-900 dark:text-white">{rec.fat}g</div>
                    </div>
                  </div>

                  {/* Grocery List */}
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3">
                      <ShoppingCart className="w-4 h-4 text-emerald-500" /> Market List
                    </h4>
                    <ul className="space-y-2">
                      {rec.groceryList.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                          <ChevronRight className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
