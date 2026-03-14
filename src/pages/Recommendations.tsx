import { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Utensils, Globe, Target, ShoppingCart, Activity, Flame, ChevronRight, Loader2 } from 'lucide-react';

interface MealRecommendation {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  groceryList: string[];
}

export default function Recommendations() {
  const [goal, setGoal] = useState('Weight Loss');
  const [healthLevel, setHealthLevel] = useState('Very Healthy');
  const [cuisine, setCuisine] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<MealRecommendation[]>([]);

  const handleGenerate = async () => {
    if (!cuisine.trim()) {
      alert('Please enter a cuisine or country.');
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Act as an expert nutritionist. The user wants meal recommendations.
      Goal: ${goal}
      Health Level: ${healthLevel}
      Cuisine/Country: ${cuisine}
      
      Provide 3 meal options that fit these criteria. For each meal, include:
      - Meal Name
      - Description
      - Estimated Calories, Protein (g), Carbs (g), Fat (g)
      - A short grocery list of items to buy from the market.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the meal" },
                description: { type: Type.STRING, description: "Short description of the meal" },
                calories: { type: Type.NUMBER, description: "Estimated calories" },
                protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
                carbs: { type: Type.NUMBER, description: "Estimated carbs in grams" },
                fat: { type: Type.NUMBER, description: "Estimated fat in grams" },
                groceryList: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of ingredients to buy from the market"
                }
              },
              required: ["name", "description", "calories", "protein", "carbs", "fat", "groceryList"]
            }
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text.trim());
        setRecommendations(data);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      alert('Failed to generate recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 font-sans space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">Meal Recommendations</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Discover meals tailored to your goals, health preferences, and favorite cuisines.</p>
      </div>

      {/* Form Section */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-zinc-200 dark:border-white/10 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Goal */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <Target className="w-4 h-4 text-orange-500" /> Your Goal
            </label>
            <select 
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
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
          className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
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
            <Flame className="w-5 h-5 text-orange-500" /> Suggested Meals
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
                          <ChevronRight className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
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
